/**
 * Self-check: FLAC↔videoUrl sidecar match + stale-invalidation decision.
 * Run: npx tsx src/tools/lib/ensureFullAudio.selfcheck.ts
 *
 * Offline — no Firebase. Exercises pure helpers + local file I/O in os.tmpdir().
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  flacMatchesVideo,
  flacSourceUrlLocalPath,
  mustInvalidateStaleVideo,
  writeFlacSourceUrl,
} from './flacSourceUrl.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'okvevo-flac-sidecar-'));
const flacPath = path.join(dir, 'audio.flac');
const urlA = 'https://storage.example/sessions/s1/video1.mp4';
const urlB = 'https://storage.example/sessions/s1/video2.mp4';

try {
  // Missing FLAC / sidecar → no match
  assert.equal(flacMatchesVideo(flacPath, urlA), false);

  fs.writeFileSync(flacPath, 'fake-flac');
  assert.equal(flacMatchesVideo(flacPath, urlA), false, 'missing sidecar → invalidate');

  // Matching sidecar → keep
  writeFlacSourceUrl(flacPath, urlA);
  assert.equal(flacMatchesVideo(flacPath, urlA), true, 'matching sidecar → keep');
  assert.ok(fs.existsSync(flacSourceUrlLocalPath(flacPath)));

  // Mismatched sidecar → invalidate
  assert.equal(flacMatchesVideo(flacPath, urlB), false, 'mismatched sidecar → invalidate');

  // Empty FLAC → no match even with sidecar
  fs.writeFileSync(flacPath, '');
  writeFlacSourceUrl(flacPath, urlA);
  assert.equal(flacMatchesVideo(flacPath, urlA), false, 'empty flac → invalidate');

  // Stale-invalidation decision: URL differ ⇒ wipe audio + reset applied
  assert.equal(mustInvalidateStaleVideo(urlA, urlB), true);
  assert.equal(mustInvalidateStaleVideo(urlA, urlA), false);
  assert.equal(mustInvalidateStaleVideo(null, urlA), false);
  assert.equal(mustInvalidateStaleVideo(undefined, urlA), false);

  console.log('ensureFullAudio.selfcheck: ok');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
