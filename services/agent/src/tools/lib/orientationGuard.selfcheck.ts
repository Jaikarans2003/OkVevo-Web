/**
 * Self-check: HTML stage match + manim fit soft notes.
 * Run: npx tsx src/tools/lib/orientationGuard.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  assertHtmlMatchesOrientation,
  manimFitNoteForClip,
  parseStageCanvasSize,
} from './orientationGuard.ts';

const verticalHtml = `
#stage { width: 1080px; height: 1920px; }
<div id="stage" data-width="1080" data-height="1920"></div>
`;
assert.deepEqual(parseStageCanvasSize(verticalHtml), { width: 1080, height: 1920 });
assertHtmlMatchesOrientation(verticalHtml, 'vertical', { width: 1080, height: 1920 });

let threw = false;
try {
  assertHtmlMatchesOrientation(verticalHtml, 'horizontal', {
    width: 1920,
    height: 1080,
  });
} catch (e) {
  threw = true;
  assert.match(String(e), /scaffold_hf_project/);
}
assert.ok(threw);

assert.ok(manimFitNoteForClip('vertical', 854, 480));
assert.ok(manimFitNoteForClip('horizontal', 1080, 1080));
assert.equal(manimFitNoteForClip('vertical', 1080, 1080), null);
assert.equal(manimFitNoteForClip('horizontal', 854, 480), null);

console.log('orientationGuard.selfcheck: ok');
