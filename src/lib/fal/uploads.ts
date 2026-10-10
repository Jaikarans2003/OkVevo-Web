/**
 * Drama reference uploads. Pure contract: paths, MIME allowlist, caps,
 * magic-byte sniffing, rate-limit and retention decisions. Firestore/GCS IO
 * lives in the route handlers. Client-reported duration is never trusted —
 * the complete route measures it from the bytes.
 */

export type UploadKind = 'video' | 'audio' | 'image';

/** GOAL allowlist: mp4/mov/webm, mp3/wav/m4a, png/jpg/webp. */
const MIME_KIND: Record<string, UploadKind> = {
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
};

const EXT_KIND: Record<string, UploadKind> = {
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
};

const MIME_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Per-kind byte caps (GOAL): video 200MB, audio 15MB, image 30MB. */
export const UPLOAD_CAPS: Record<UploadKind, number> = {
  video: 200 * 1024 * 1024,
  audio: 15 * 1024 * 1024,
  image: 30 * 1024 * 1024,
};

/** Reference images are normalized ≤2048px (deterministic GPT/H3 bounds). */
export const UPLOAD_IMAGE_MAX_EDGE = 2048;

/** Signed-URL lifetimes. GET must outlive the 6h submitted-hold ceiling. */
export const SIGNED_PUT_TTL_MS = 15 * 60 * 1000;
export const SIGNED_GET_TTL_MS = 8 * 60 * 60 * 1000;

/** Lifecycle deletes drama-inputs/ after 7 days; records older than that are dead. */
export const UPLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Per-user create rate limit (upload completes don't count). */
export const UPLOAD_RATE_LIMIT = 30;
export const UPLOAD_RATE_WINDOW_MS = 60 * 60 * 1000;

export function uploadKindOfMime(contentType: string): UploadKind | null {
  return MIME_KIND[contentType.trim().toLowerCase()] ?? null;
}

export function uploadExtForMime(contentType: string): string | null {
  return MIME_EXT[contentType.trim().toLowerCase()] ?? null;
}

export function uploadPath(uid: string, uuid: string, ext: string): string {
  return `drama-inputs/${uid}/${uuid}.${ext}`;
}

/** Path belongs to this uid and sits under the drama-inputs prefix only. */
export function uploadPathOwnedBy(path: string, uid: string): boolean {
  const prefix = `drama-inputs/${uid}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  if (!rest || rest.includes('/') || rest.includes('..')) return false;
  const dot = rest.lastIndexOf('.');
  if (dot <= 0) return false;
  return EXT_KIND[rest.slice(dot + 1).toLowerCase()] != null;
}

export function uploadKindOfPath(path: string): UploadKind | null {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_KIND[path.slice(dot + 1).toLowerCase()] ?? null;
}

export function uploadIdFromPath(path: string): string | null {
  const name = path.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = name.slice(0, dot);
  return /^[0-9a-f-]{36}$/.test(id) ? id : null;
}

/** Magic-byte sniff → kind. Returns null when bytes match nothing allowlisted. */
export function sniffUploadKind(bytes: Uint8Array): UploadKind | null {
  const b = bytes;
  const at = (i: number) => b[i];
  const str = (off: number, len: number) =>
    String.fromCharCode(...b.subarray(off, off + len));
  if (b.length >= 12 && str(4, 4) === 'ftyp') {
    const brand = str(8, 4);
    if (brand === 'qt  ') return 'video'; // mov
    if (brand === 'M4A ' || brand === 'M4B ') return 'audio';
    return 'video'; // isom/mp41/mp42/avc1/iso5 → mp4
  }
  if (b.length >= 4 && at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3) {
    return 'video'; // EBML → webm
  }
  if (b.length >= 3 && str(0, 3) === 'ID3') return 'audio'; // mp3
  if (b.length >= 2 && at(0) === 0xff && (at(1) & 0xe0) === 0xe0) return 'audio'; // mp3 frame sync
  if (b.length >= 12 && str(0, 4) === 'RIFF' && str(8, 4) === 'WAVE') return 'audio';
  if (b.length >= 12 && str(0, 4) === 'RIFF' && str(8, 4) === 'WEBP') return 'image';
  if (b.length >= 8 && at(0) === 0x89 && str(1, 3) === 'PNG') return 'image';
  if (b.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image'; // jpeg
  return null;
}

export type UploadRateWindow = { windowStartMs: number; count: number };

/** Pure fixed-window decision; the route persists the returned window. */
export function uploadRateDecision(
  prior: UploadRateWindow | null,
  nowMs: number
): { allowed: boolean; window: UploadRateWindow } {
  if (!prior || nowMs - prior.windowStartMs >= UPLOAD_RATE_WINDOW_MS) {
    return { allowed: true, window: { windowStartMs: nowMs, count: 1 } };
  }
  const count = prior.count + 1;
  return { allowed: count <= UPLOAD_RATE_LIMIT, window: { windowStartMs: prior.windowStartMs, count } };
}

/** Upload records older than the lifecycle retention must not be handed to Fal. */
export function uploadExpired(createdAtMs: number, nowMs: number): boolean {
  return nowMs - createdAtMs >= UPLOAD_TTL_MS;
}
