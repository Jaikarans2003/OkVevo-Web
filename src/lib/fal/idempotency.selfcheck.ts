/**
 * Same file + same run_id is a replay (one hold). A different
 * drama-upload:// id with the same run_id is 409 and never holds.
 * Run: npx tsx src/lib/fal/idempotency.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { canonicalBodyHash, memorySubmit } from '@/lib/fal/idempotency';

const hashA = canonicalBodyHash({
  endpoint: 'minimax/h3-max/image-to-video',
  submitArgs: { duration: 6 },
  mediaArgs: { image_url: 'drama-upload://uuid-a' },
  runId: 'r1',
});
const hashB = canonicalBodyHash({
  endpoint: 'minimax/h3-max/image-to-video',
  submitArgs: { duration: 6 },
  mediaArgs: { image_url: 'drama-upload://uuid-b' },
  runId: 'r1',
});
const hashSigned = canonicalBodyHash({
  endpoint: 'minimax/h3-max/image-to-video',
  submitArgs: { duration: 6 },
  mediaArgs: { image_url: 'https://storage.googleapis.com/bucket/x?X-Goog-Signature=abc' },
  runId: 'r1',
});
assert.notEqual(hashA, hashB);
assert.notEqual(hashA, hashSigned);

const store = new Map();
const first = memorySubmit({
  store,
  key: 'u:r1',
  uid: 'u',
  runId: 'r1',
  bodyHash: hashA,
  fal: () => 'fal-1',
});
assert.equal(first.status, 200);
assert.equal(first.falRequestId, 'fal-1');
assert.equal(first.holds, 1);
assert.equal(first.falCalls, 1);

const replay = memorySubmit({
  store,
  key: 'u:r1',
  uid: 'u',
  runId: 'r1',
  bodyHash: hashA,
  fal: () => 'fal-2',
});
assert.equal(replay.status, 200);
assert.equal(replay.falRequestId, 'fal-1');
assert.equal(replay.holds, 1);
assert.equal(replay.falCalls, 1);

const conflict = memorySubmit({
  store,
  key: 'u:r1',
  uid: 'u',
  runId: 'r1',
  bodyHash: hashB,
  fal: () => 'fal-3',
});
assert.equal(conflict.status, 409);
assert.equal(conflict.holds, 1);
assert.equal(conflict.falCalls, 1);

console.log('idempotency.selfcheck: ok');
