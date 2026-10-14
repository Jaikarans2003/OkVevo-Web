/**
 * Same run_id + same file retried (signed URL re-minted) replays the
 * original result: one hold, one Fal call. Covers image refs, video refs,
 * and voice-clone audio_url. A different file with the same run_id is 409
 * and never holds.
 * Run: npx tsx src/lib/fal/idempotency.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  clientRequestHash,
  hashableClientRequest,
  memorySubmit,
  type MemoryRun,
} from '@/lib/fal/idempotency';

const IMG = '11111111-2222-4333-8444-555555555555';
const IMG2 = '11111111-2222-4333-8444-555555555556';
const VID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const VID2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeef';
const AUD = '99999999-8888-4777-a666-555555555555';
const AUD2 = '99999999-8888-4777-a666-555555555556';
const FAL_CLIP = 'https://v3b.fal.media/files/clip.mp4';

function upload(id: string): string {
  return `drama-upload://${id}`;
}

/** What the server would hold after minting a fresh signed GET. */
function remint(body: Record<string, unknown>, sig: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && (value.startsWith('drama-upload://') || value.includes('fal.media'))) {
      out[key] = `https://storage.googleapis.com/bucket/${sig}?X-Goog-Signature=${key}`;
    } else if (Array.isArray(value)) {
      out[key] = value.map((item, i) =>
        typeof item === 'string'
          ? `https://storage.googleapis.com/bucket/${sig}-${i}?X-Goog-Signature=${key}`
          : item
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

const cases: Array<{
  name: string;
  endpoint: string;
  same: Record<string, unknown>;
  other: Record<string, unknown>;
}> = [
  {
    name: 'image',
    endpoint: 'minimax/h3-max/image-to-video',
    same: { resolution: '768P', duration: 6, prompt: 'scene', image_url: upload(IMG) },
    other: { resolution: '768P', duration: 6, prompt: 'scene', image_url: upload(IMG2) },
  },
  {
    name: 'video',
    endpoint: 'minimax/h3-max/reference-to-video',
    same: {
      duration: 6,
      prompt: 'scene',
      video_urls: [upload(VID)],
      reference_video_urls: [FAL_CLIP],
    },
    other: {
      duration: 6,
      prompt: 'scene',
      video_urls: [upload(VID2)],
      reference_video_urls: [FAL_CLIP],
    },
  },
  {
    name: 'voice-clone audio_url',
    endpoint: 'fal-ai/minimax/voice-clone',
    same: { prompt: 'clone', audio_url: upload(AUD) },
    other: { prompt: 'clone', audio_url: upload(AUD2) },
  },
];

assert.equal(
  clientRequestHash('m', { prompt: 'p', duration: 4, resolution: '480p' }),
  clientRequestHash('m', { resolution: '480p', prompt: 'p', duration: 4 }),
  'sorted keys: param order does not change the hash'
);

for (const c of cases) {
  const stable = clientRequestHash(c.endpoint, c.same);
  assert.equal(stable, clientRequestHash(c.endpoint, c.same), `${c.name}: same client request`);
  const mintedA = clientRequestHash(c.endpoint, remint(c.same, 'mint-a'));
  const mintedB = clientRequestHash(c.endpoint, remint(c.same, 'mint-b'));
  assert.notEqual(mintedA, mintedB, `${c.name}: signed URLs are not a stable id`);
  assert.notEqual(stable, mintedA, `${c.name}: hash must be the client ref, not the signed URL`);
  assert.equal(
    JSON.stringify(hashableClientRequest(c.endpoint, c.same)).includes('X-Goog-Signature'),
    false,
    `${c.name}: canonical form has no signed URL`
  );

  const store = new Map<string, MemoryRun>();
  const first = memorySubmit({
    store,
    key: 'u:r1',
    uid: 'u',
    runId: 'r1',
    bodyHash: stable,
    fal: () => 'fal-1',
  });
  assert.equal(first.status, 200, c.name);
  assert.equal(first.holds, 1, c.name);
  assert.equal(first.falCalls, 1, c.name);

  const replay = memorySubmit({
    store,
    key: 'u:r1',
    uid: 'u',
    runId: 'r1',
    bodyHash: stable,
    fal: () => 'fal-2',
  });
  assert.equal(replay.status, 200, `${c.name}: replay`);
  assert.equal(replay.falRequestId, 'fal-1', `${c.name}: original result`);
  assert.equal(replay.holds, 1, `${c.name}: no new hold`);
  assert.equal(replay.falCalls, 1, `${c.name}: no new Fal call`);

  const conflict = memorySubmit({
    store,
    key: 'u:r1',
    uid: 'u',
    runId: 'r1',
    bodyHash: clientRequestHash(c.endpoint, c.other),
    fal: () => 'fal-3',
  });
  assert.equal(conflict.status, 409, `${c.name}: different file`);
  assert.equal(conflict.holds, 1, `${c.name}: 409 writes no hold`);
  assert.equal(conflict.falCalls, 1, `${c.name}: 409 makes no Fal call`);
}

const voice = hashableClientRequest('fal-ai/minimax/voice-clone', {
  prompt: 'clone',
  audio_url: upload(AUD),
  duration: 10,
});
assert.equal(voice.submitArgs.audio_url, undefined, 'audio_url is not hashed as a submit field');
assert.equal(voice.submitArgs.prompt, 'clone');
assert.equal(voice.submitArgs.duration, 10);
assert.equal(voice.mediaArgs.audio_url, upload(AUD), 'audio_url is hashed as the stable upload id');
assert.equal(voice.endpoint, 'fal-ai/minimax/voice-clone');

const video = hashableClientRequest('minimax/h3-max/reference-to-video', cases[1].same);
assert.deepEqual(video.mediaArgs.video_urls, [upload(VID)]);
assert.deepEqual(video.mediaArgs.reference_video_urls, [FAL_CLIP]);
assert.equal(video.submitArgs.video_urls, undefined);
assert.equal(video.submitArgs.prompt, 'scene');

console.log('idempotency.selfcheck: ok');
