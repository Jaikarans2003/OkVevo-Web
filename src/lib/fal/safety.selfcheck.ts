/**
 * Image submits request Fal's checker off; video is left alone.
 * Run: npx tsx src/lib/fal/safety.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { applyFalSafetyOff } from './safety.ts';

const klein = applyFalSafetyOff('fal-ai/flux-2/klein/9b', {
  prompt: 'a cat',
  enable_safety_checker: true,
});
assert.equal(klein.enable_safety_checker, false);
assert.equal(klein.prompt, 'a cat');

const banana = applyFalSafetyOff('fal-ai/nano-banana-pro', {
  prompt: 'a cat',
  safety_tolerance: '4',
});
assert.equal(banana.safety_tolerance, '6');
assert.equal(banana.enable_safety_checker, undefined);

const veo = applyFalSafetyOff('fal-ai/veo3.1', { prompt: 'a clip', duration: 8 });
assert.deepEqual(veo, { prompt: 'a clip', duration: 8 });

console.log('safety.selfcheck: ok');
