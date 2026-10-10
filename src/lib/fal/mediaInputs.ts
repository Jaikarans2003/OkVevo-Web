/**
 * Media inputs for Fal submits. Pure classification + endpoint validation;
 * Firestore/GCS IO lives in mediaResolve.ts.
 *
 * Only two reference forms may reach Fal:
 *   drama-upload://<uuid>   — measured upload (dramaUploads + Storage)
 *   https://*.fal.media/... — a PRIOR Fal output recorded in falMediaIndex
 * Anything else (foreign URLs, data URLs, raw paths) fails BEFORE any hold.
 */

import type { MediaContext } from '@/lib/fal/rateCard';

/** Arg keys that carry media, and the shape of each. */
export const MEDIA_ARG_KEYS: Record<string, 'image' | 'image[]' | 'audio' | 'video[]' | 'audio[]'> = {
  image_url: 'image',
  start_image_url: 'image',
  end_image_url: 'image',
  middle_image_url: 'image',
  mask_url: 'image',
  target_audio_url: 'audio',
  audio_url: 'audio',
  image_urls: 'image[]',
  reference_image_urls: 'image[]',
  video_urls: 'video[]',
  reference_video_urls: 'video[]',
  audio_urls: 'audio[]',
  reference_audio_urls: 'audio[]',
};

export type MediaRef = { kind: 'upload'; id: string } | { kind: 'fal'; url: string };

/** Returns the ref, or an error string. */
export function classifyMediaValue(value: unknown): MediaRef | string {
  if (typeof value !== 'string' || !value) return 'media reference must be a string';
  if (value.startsWith('drama-upload://')) {
    const id = value.slice('drama-upload://'.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      return 'invalid drama-upload reference';
    }
    return { kind: 'upload', id };
  }
  if (value.startsWith('data:')) {
    return 'inline media is not accepted — upload the file first (POST /api/fal/uploads)';
  }
  if (/^https:\/\//i.test(value)) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (host === 'fal.media' || host.endsWith('.fal.media')) return { kind: 'fal', url: value };
    } catch {
      /* fall through */
    }
    return 'only Fal media URLs (fal.media) or drama-upload:// references are accepted — never a user-supplied URL';
  }
  return 'unsupported media reference — use drama-upload:// or a Fal output URL';
}

export type MeasuredMedia = {
  kind: 'video' | 'audio' | 'image';
  seconds?: number;
  width?: number;
  height?: number;
};

export type MediaEntry = { key: string; measured: MeasuredMedia };

type ShapeKind = 'image' | 'audio' | 'video';

function expectedKind(key: string): { kind: ShapeKind; many: boolean } {
  const shape = MEDIA_ARG_KEYS[key];
  if (!shape) throw new Error(`unknown media key ${key}`);
  return { kind: shape.replace('[]', '') as ShapeKind, many: shape.endsWith('[]') };
}

/** Per-endpoint reference limits from the Fal OpenAPI schemas (maxItems etc). */
const REF_LIMITS: Record<
  string,
  {
    images?: number;
    videos?: number;
    audios?: number;
    total?: number;
    videoEachMin?: number;
    videoEachMax?: number;
    videoSum?: number;
    audioSum?: number;
    task?: boolean;
    upgrade?: string;
  }
> = {
  'bytedance/seedance-2.5/reference-to-video': {
    images: 30,
    videos: 10,
    audios: 10,
    total: 50,
    videoEachMin: 1.8,
    videoEachMax: 30.2,
    videoSum: 30.2,
    audioSum: 30.2,
    task: true,
  },
  'bytedance/seedance-2.0/reference-to-video': {
    images: 9,
    videos: 3,
    audios: 3,
    total: 12,
    videoSum: 15,
    audioSum: 15,
    upgrade: 'bytedance/seedance-2.5/reference-to-video',
  },
  'minimax/h3-max/reference-to-video': { images: 12, videos: 3, audios: 3 },
  'alibaba/wan-3.0-prime/reference-to-video': { images: 10, videos: 5, audios: 5 },
  'openai/gpt-image-2/edit': { images: 16 },
  'fal-ai/minimax/voice-clone': { audios: 1 },
};

const NO_MEDIA = new Set([
  'bytedance/seedance-2.0/text-to-video',
  'bytedance/seedance-2.5/text-to-video',
  'minimax/h3-max/text-to-video',
  'alibaba/wan-3.0-prime/text-to-video',
  'openai/gpt-image-2',
  'minimax/music-3',
  'fal-ai/minimax/speech-02-hd',
]);

const FIRST_FRAME_REQUIRED: Record<string, string> = {
  'bytedance/seedance-2.0/image-to-video': 'image_url',
  'bytedance/seedance-2.5/image-to-video': 'image_url',
  'minimax/h3-max/image-to-video': 'image_url',
  'alibaba/wan-3.0-prime/image-to-video': 'start_image_url',
};

const VALID_TASKS = new Set(['reference', 'editing', 'extension']);

/**
 * Validate one job's media entries against the endpoint's schema and build
 * the metering MediaContext. Returns { media } or { error } — the error names
 * a model that supports the requested shape where one exists.
 */
export function validateAndBuildMedia(
  endpoint: string,
  entries: MediaEntry[],
  args: Record<string, unknown>
): { media: MediaContext } | { error: string } {
  const task = typeof args.task === 'string' ? args.task : null;
  if (task && endpoint !== 'bytedance/seedance-2.5/reference-to-video') {
    return {
      error:
        'edit and extend (task) exist only on bytedance/seedance-2.5/reference-to-video — ' +
        `${endpoint} does not accept a task field`,
    };
  }
  if (task && !VALID_TASKS.has(task)) {
    return { error: `task must be one of reference, editing, extension` };
  }

  if (NO_MEDIA.has(endpoint) && entries.length > 0) {
    return { error: `${endpoint} takes no reference media` };
  }

  const firstFrameKey = FIRST_FRAME_REQUIRED[endpoint];
  if (firstFrameKey && !entries.some((e) => e.key === firstFrameKey)) {
    return { error: `${endpoint} requires a first-frame image (${firstFrameKey})` };
  }

  for (const e of entries) {
    const { kind } = expectedKind(e.key);
    if (e.measured.kind !== kind) {
      return { error: `${e.key} expects ${kind} media, got ${e.measured.kind}` };
    }
  }

  const limit = REF_LIMITS[endpoint];
  const videos = entries.filter((e) => expectedKind(e.key).kind === 'video');
  const audios = entries.filter((e) => expectedKind(e.key).kind === 'audio');
  const images = entries.filter((e) => expectedKind(e.key).kind === 'image');

  if (limit) {
    const up = limit.upgrade ? ` — ${limit.upgrade} accepts more` : '';
    if (limit.images != null && images.length > limit.images) {
      return { error: `${endpoint} accepts at most ${limit.images} reference images${up}` };
    }
    if (limit.videos != null && videos.length > limit.videos) {
      return { error: `${endpoint} accepts at most ${limit.videos} reference videos${up}` };
    }
    if (limit.audios != null && audios.length > limit.audios) {
      return { error: `${endpoint} accepts at most ${limit.audios} reference audios${up}` };
    }
    if (limit.total != null && entries.length > limit.total) {
      return { error: `${endpoint} accepts at most ${limit.total} reference files in total${up}` };
    }
    for (const v of videos) {
      const s = v.measured.seconds ?? 0;
      if (limit.videoEachMin != null && s < limit.videoEachMin) {
        return { error: `${endpoint} reference videos must be at least ${limit.videoEachMin}s each` };
      }
      if (limit.videoEachMax != null && s > limit.videoEachMax) {
        return { error: `${endpoint} reference videos must be at most ${limit.videoEachMax}s each${up}` };
      }
    }
    const videoSum = videos.reduce((n, v) => n + (v.measured.seconds ?? 0), 0);
    if (limit.videoSum != null && videoSum > limit.videoSum) {
      return { error: `${endpoint} reference videos must total ${limit.videoSum}s or less${up}` };
    }
    const audioSum = audios.reduce((n, a) => n + (a.measured.seconds ?? 0), 0);
    if (limit.audioSum != null && audioSum > limit.audioSum) {
      return { error: `${endpoint} reference audios must total ${limit.audioSum}s or less${up}` };
    }
  }

  if (entries.some((e) => e.key === 'audio_url') && endpoint !== 'fal-ai/minimax/voice-clone') {
    return { error: 'audio_url is only valid on fal-ai/minimax/voice-clone' };
  }
  if (endpoint === 'fal-ai/minimax/voice-clone') {
    const s = audios[0]?.measured.seconds ?? 0;
    if (audios.length < 1 || s < 10) {
      return {
        error: `voice-clone requires a server-measured sample of at least 10 seconds (got ${s}s)`,
      };
    }
  }

  if (endpoint === 'bytedance/seedance-2.0/reference-to-video') {
    if (audios.length > 0 && images.length === 0 && videos.length === 0) {
      return { error: 'seedance-2.0 reference audio needs at least one image or video alongside' };
    }
  }
  if (endpoint === 'bytedance/seedance-2.5/reference-to-video') {
    if ((task === 'editing' || task === 'extension') && videos.length === 0) {
      return { error: `seedance-2.5 ${task} requires a video input (video_urls)` };
    }
  }

  // Metering context. H3 counts every image input toward reference tokens
  // (first/middle/last frames included — conservative, the 4,096-token
  // allowance absorbs small over-counts). Seedance only bills video inputs.
  const media: MediaContext = {
    videos: videos.map((v) => ({ seconds: v.measured.seconds ?? 0 })),
    audios: audios.map((a) => ({ seconds: a.measured.seconds ?? 0 })),
    images: images.map((i) => ({ width: i.measured.width ?? 0, height: i.measured.height ?? 0 })),
  };
  return { media };
}

/** sha256 of a Fal media URL = falMediaIndex doc id (settle writes, submits read). */
export type FalMediaIndexEntry = {
  url: string;
  kind: 'video' | 'audio' | 'image';
  seconds?: number;
  width?: number;
  height?: number;
};

/**
 * Extract output media from a result payload for the falMediaIndex.
 * Shapes: video → payload.video.url (+duration), gpt → payload.images[],
 * music/speech → payload.audio.url (+duration / duration_ms).
 */
export function payloadMediaEntries(
  endpoint: string,
  payload: unknown,
  submitArgs: Record<string, unknown>
): FalMediaIndexEntry[] {
  const rec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const out: FalMediaIndexEntry[] = [];
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
  const video = rec.video && typeof rec.video === 'object' ? (rec.video as Record<string, unknown>) : null;
  if (video && typeof video.url === 'string') {
    out.push({
      url: video.url,
      kind: 'video',
      seconds: num(video.duration) ?? num(rec.duration) ?? num(submitArgs.duration),
      width: num(video.width) ?? num(rec.width),
      height: num(video.height) ?? num(rec.height),
    });
  }
  const images = Array.isArray(rec.images) ? rec.images : [];
  for (const img of images) {
    const r = img && typeof img === 'object' ? (img as Record<string, unknown>) : {};
    if (typeof r.url === 'string') {
      out.push({ url: r.url, kind: 'image', width: num(r.width), height: num(r.height) });
    }
  }
  const audio = rec.audio && typeof rec.audio === 'object' ? (rec.audio as Record<string, unknown>) : null;
  if (audio && typeof audio.url === 'string') {
    out.push({
      url: audio.url,
      kind: 'audio',
      seconds: num(rec.duration) ?? (num(rec.duration_ms) ? num(rec.duration_ms)! / 1000 : undefined),
    });
  }
  return out;
}
