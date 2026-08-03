/**
 * Self-check: vertical Manim needs BOTH square CLI pixels and equal frame units.
 * Run: npx tsx src/tools/lib/manimOrientation.selfcheck.ts
 */
import assert from 'node:assert';
import {
  assertSquareManimFrame,
  buildManimRenderCmd,
  resolveToolOrientation,
} from './manimOrientation';

assert.deepStrictEqual(resolveToolOrientation('vertical', 'horizontal'), {
  orientation: 'vertical',
  persist: true,
});
assert.deepStrictEqual(resolveToolOrientation(undefined, 'vertical'), {
  orientation: 'vertical',
  persist: false,
});
assert.deepStrictEqual(resolveToolOrientation(undefined, 'horizontal'), {
  orientation: 'horizontal',
  persist: false,
});

const hCmd = buildManimRenderCmd({
  scriptPath: '/tmp/s.py',
  className: 'SceneX',
  outputDir: '/tmp/out',
  orientation: 'horizontal',
});
assert(!hCmd.includes('--resolution'), `horizontal must not pass --resolution: ${hCmd}`);
assert(hCmd.includes('-ql'), `horizontal must use -ql: ${hCmd}`);

const vCmd = buildManimRenderCmd({
  scriptPath: '/tmp/s.py',
  className: 'SceneX',
  outputDir: '/tmp/out',
  orientation: 'vertical',
});
assert(vCmd.includes('--resolution 1080,1080'), `vertical must pass 1080,1080: ${vCmd}`);
assert(vCmd.includes('-ql'), `vertical must still use -ql: ${vCmd}`);

assert.strictEqual(assertSquareManimFrame('from manim import *\n'), 'vertical Manim scripts must set config.frame_width and config.frame_height to equal values (e.g. 8)');
assert.strictEqual(
  assertSquareManimFrame('config.frame_width = 8\nconfig.frame_height = 14\n'),
  'vertical Manim frame_width (8) must equal frame_height (14)'
);
assert.strictEqual(
  assertSquareManimFrame('config.frame_width = 8\nconfig.frame_height = 8\n'),
  null
);
// Horizontal scripts are not forced to set frame_* — missing is fine for that path.
assert.strictEqual(
  assertSquareManimFrame('# no frame config\nfrom manim import *\n'),
  'vertical Manim scripts must set config.frame_width and config.frame_height to equal values (e.g. 8)'
);

console.log('manimOrientation.selfcheck: ok');
