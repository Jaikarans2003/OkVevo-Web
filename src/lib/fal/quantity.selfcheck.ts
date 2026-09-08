/**
 * Fal quantity + 0.2c meter tests. Especially duration=7 vs inference_time=276.
 * Run: npx tsx src/lib/fal/quantity.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { isMeterableEndpoint } from './allowlist.ts';
import { adjustedUsd, quantity } from './quantity.ts';
import { parseFalQueuePath } from './queuePath.ts';

const UNIT_PRICE = 3.25 / 7;

const trap = quantity({
  unit: 'seconds',
  args: { duration: 7 },
  metrics: { inference_time: 276 },
  timings: { inference: 276 },
  payload: { video: { duration: 7 } },
});
assert.equal(trap, 7);
const trapUsd = UNIT_PRICE * trap;
assert.ok(Math.abs(trapUsd - 3.25) < 1e-9, `expected ~$3.25, got ${trapUsd}`);
assert.ok(trapUsd < 10, 'must not bill wall-clock');
assert.notEqual(276 * UNIT_PRICE, trapUsd);

const images = quantity({
  unit: 'images',
  args: { num_images: 2 },
  metrics: { inference_time: 99 },
});
assert.equal(images, 2);

const mp = quantity({
  unit: 'megapixels',
  endpoint: 'fal-ai/flux-2/klein/9b',
  args: { image_size: { width: 1024, height: 1024 } },
});
assert.equal(mp, (1024 * 1024) / 1e6);
assert.ok(Math.abs(mp * 0.006 - 0.006291456) < 1e-12);

const ltxQty = quantity({
  unit: 'megapixels',
  endpoint: 'fal-ai/ltx-2.3-22b/text-to-video',
  args: { width: 1280, height: 720, num_frames: 121 },
});
// 1280×720×121 = 111.5136 MP → ceil 112; page example ≈$0.179
assert.equal(ltxQty, Math.ceil((1280 * 720 * 121) / 1e6));
assert.equal(ltxQty, 112);
assert.ok(Math.abs(ltxQty * 0.001605 - 0.17976) < 1e-9);

const seedance = quantity({
  unit: '1000 tokens',
  endpoint: 'bytedance/seedance-2.0/text-to-video',
  args: { width: 1280, height: 720, duration: 7 },
  metrics: { inference_time: 276 },
});
assert.equal(seedance, (720 * 1280 * 7 * 24) / 1024 / 1000);
const wallClockTokens = (720 * 1280 * 276 * 24) / 1024 / 1000;
assert.notEqual(seedance, wallClockTokens);

assert.equal(isMeterableEndpoint('fal-ai/gpt-image-1.5'), false);
assert.equal(isMeterableEndpoint('fal-ai/flux-2/klein/9b'), true);

let threw = false;
try {
  quantity({ unit: 'compute seconds', args: {}, metrics: { inference_time: 276 } });
} catch {
  threw = true;
}
assert.equal(threw, true, 'compute seconds is not consulted for 6a');

threw = false;
try {
  quantity({ unit: 'units', endpoint: 'fal-ai/gpt-image-1.5', args: {} });
} catch {
  threw = true;
}
assert.equal(threw, true);

const veo = adjustedUsd({
  endpoint: 'fal-ai/veo3.1',
  args: { generate_audio: false, resolution: '720p' },
  unitPrice: 0.4,
  qty: 8,
});
assert.equal(veo, 0.4 * 8 * 0.5);

const submit = parseFalQueuePath(['fal-ai', 'flux-2', 'klein', '9b']);
assert.deepEqual(submit, { kind: 'submit', endpoint: 'fal-ai/flux-2/klein/9b' });
const status = parseFalQueuePath([
  'fal-ai',
  'flux-2',
  'klein',
  '9b',
  'requests',
  'req-1',
  'status',
]);
assert.equal(status.kind, 'status');
assert.equal(status.requestId, 'req-1');
assert.equal(status.endpoint, 'fal-ai/flux-2/klein/9b');

console.log('quantity.selfcheck: ok');
