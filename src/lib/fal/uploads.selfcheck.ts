/**
 * Upload contract vectors: MIME allowlist, caps, path ownership, magic-byte
 * sniffing, rate-limit window, retention. Run: npx tsx src/lib/fal/uploads.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  sniffUploadKind,
  UPLOAD_CAPS,
  UPLOAD_IMAGE_MAX_EDGE,
  UPLOAD_RATE_LIMIT,
  UPLOAD_RATE_WINDOW_MS,
  UPLOAD_TTL_MS,
  uploadExpired,
  uploadExtForMime,
  uploadIdFromPath,
  uploadKindOfMime,
  uploadKindOfPath,
  uploadPath,
  uploadPathOwnedBy,
  uploadRateDecision,
} from '@/lib/fal/uploads';

// MIME allowlist — exactly the GOAL set.
for (const [mime, kind] of [
  ['video/mp4', 'video'],
  ['video/quicktime', 'video'],
  ['video/webm', 'video'],
  ['audio/mpeg', 'audio'],
  ['audio/wav', 'audio'],
  ['audio/mp4', 'audio'],
  ['image/png', 'image'],
  ['image/jpeg', 'image'],
  ['image/webp', 'image'],
] as const) {
  assert.equal(uploadKindOfMime(mime), kind, mime);
}
for (const bad of ['application/pdf', 'video/x-msvideo', 'audio/ogg', 'image/gif', 'image/svg+xml', '']) {
  assert.equal(uploadKindOfMime(bad), null, bad);
  assert.equal(uploadExtForMime(bad), null, bad);
}
assert.equal(UPLOAD_CAPS.video, 200 * 1024 * 1024);
assert.equal(UPLOAD_CAPS.audio, 15 * 1024 * 1024);
assert.equal(UPLOAD_CAPS.image, 30 * 1024 * 1024);
assert.equal(UPLOAD_IMAGE_MAX_EDGE, 2048);

// Paths.
const p = uploadPath('uid1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'mp4');
assert.equal(p, 'drama-inputs/uid1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.mp4');
assert.equal(uploadPathOwnedBy(p, 'uid1'), true);
assert.equal(uploadPathOwnedBy(p, 'uid2'), false);
assert.equal(uploadPathOwnedBy('users/uid1/x.mp4', 'uid1'), false);
assert.equal(uploadPathOwnedBy('drama-inputs/uid1/../uid2/x.mp4', 'uid1'), false);
assert.equal(uploadPathOwnedBy('drama-inputs/uid1/a/b.mp4', 'uid1'), false);
assert.equal(uploadPathOwnedBy('drama-inputs/uid1/x.pdf', 'uid1'), false);
assert.equal(uploadKindOfPath(p), 'video');
assert.equal(uploadIdFromPath(p), 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
assert.equal(uploadIdFromPath('drama-inputs/u/not-a-uuid.mp4'), null);

// Magic bytes.
const bytes = (arr: number[]) => new Uint8Array(arr);
const ftyp = (brand: string) => {
  const b = new Uint8Array(16);
  b.set([0, 0, 0, 24, 102, 116, 121, 112]); // ....ftyp
  for (let i = 0; i < 4; i += 1) b[8 + i] = brand.charCodeAt(i);
  return b;
};
assert.equal(sniffUploadKind(ftyp('isom')), 'video');
assert.equal(sniffUploadKind(ftyp('qt  ')), 'video');
assert.equal(sniffUploadKind(ftyp('M4A ')), 'audio');
assert.equal(sniffUploadKind(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x93])), 'video'); // webm
assert.equal(sniffUploadKind(bytes([0x49, 0x44, 0x33, 4, 0])), 'audio'); // ID3 mp3
assert.equal(sniffUploadKind(bytes([0xff, 0xfb, 0x90, 0])), 'audio'); // mp3 frame
const wav = new Uint8Array(12);
wav.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]); // RIFF....WAVE
assert.equal(sniffUploadKind(wav), 'audio');
const webp = new Uint8Array(12);
webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); // RIFF....WEBP
assert.equal(sniffUploadKind(webp), 'image');
assert.equal(sniffUploadKind(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image'); // png
assert.equal(sniffUploadKind(bytes([0xff, 0xd8, 0xff, 0xe0])), 'image'); // jpeg
assert.equal(sniffUploadKind(bytes([0x25, 0x50, 0x44, 0x46])), null); // pdf rejected

// Rate limit: fixed window, UPLOAD_RATE_LIMIT per hour.
const t0 = Date.parse('2026-10-10T00:00:00Z');
let win: { windowStartMs: number; count: number } | null = null;
for (let i = 0; i < UPLOAD_RATE_LIMIT; i += 1) {
  const d = uploadRateDecision(win, t0);
  assert.equal(d.allowed, true, `upload ${i + 1}`);
  win = d.window;
}
assert.equal(uploadRateDecision(win, t0).allowed, false);
assert.equal(uploadRateDecision(win, t0 + UPLOAD_RATE_WINDOW_MS).allowed, true);

// Retention.
assert.equal(uploadExpired(t0, t0 + UPLOAD_TTL_MS - 1), false);
assert.equal(uploadExpired(t0, t0 + UPLOAD_TTL_MS), true);

console.log('uploads.selfcheck: ok');
