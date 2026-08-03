/**
 * Self-check: cloud CLI gets 1080p + aspect-ratio (never --resolution portrait).
 * Run: npx tsx src/tools/lib/cloudRenderFlags.selfcheck.ts
 */
import assert from 'node:assert';
import { canvasForOrientation, cloudRenderFlags } from './utils';

assert.strictEqual(canvasForOrientation('vertical').aspectRatio, '9:16');
assert.strictEqual(canvasForOrientation('horizontal').aspectRatio, '16:9');

assert.strictEqual(
  cloudRenderFlags('vertical'),
  '--resolution 1080p --aspect-ratio 9:16'
);
assert.strictEqual(
  cloudRenderFlags('horizontal'),
  '--resolution 1080p --aspect-ratio 16:9'
);
assert.ok(!cloudRenderFlags('vertical').includes('portrait'));

console.log('cloudRenderFlags.selfcheck: ok');
