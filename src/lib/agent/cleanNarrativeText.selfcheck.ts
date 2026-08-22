/**
 * Ordered pipeline self-check: URL-first then optional stack scrub.
 * Run: npx tsx src/lib/agent/cleanNarrativeText.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { cleanNarrativeText } from './cleanNarrativeText.ts';

const falMixed =
  'Saved to Firebase: https://v3.fal.media/foo.mp4 and a Manim script';
const falClean = cleanNarrativeText(falMixed, { scrubStackNames: true });
assert.equal(falClean.includes('Firebase'), false, 'no Firebase');
assert.equal(falClean.includes('Manim'), false, 'no Manim');
assert.equal(falClean.includes('fal.media'), false, 'no fal.media');
assert.equal(falClean.includes('https://'), false, 'no https');
assert.equal(falClean.includes('v3..media'), false, 'no mangled fal host');
assert.equal(falClean.includes('.media'), false, 'no .media remnant');

const fbUrl =
  'Saved to Firebase via Manim: https://firebasestorage.googleapis.com/v0/b/demo/o/x.mp4?alt=media';
const fbClean = cleanNarrativeText(fbUrl, { scrubStackNames: true });
assert.equal(fbClean.includes('Firebase'), false);
assert.equal(fbClean.includes('Manim'), false);
assert.equal(fbClean.includes('firebasestorage'), false);
assert.equal(fbClean.includes('https://'), false);
assert.equal(fbClean.includes('googleapis'), false, 'no host-fragment leftover');

assert.equal(
  cleanNarrativeText('Generating the first Manim script', {
    scrubStackNames: true,
  }).includes('Manim'),
  false,
  'consumer scrub removes Manim'
);

assert.equal(
  cleanNarrativeText('Generating the first Manim script', {
    scrubStackNames: false,
  }).includes('Manim'),
  true,
  'dev path keeps Manim'
);

assert.equal(
  cleanNarrativeText(
    'Next up.\n\n<transcribe_video>\n{"video_url":"https://x"}\n</transcribe_video>\n\nOn it.'
  ),
  'Next up.\n\nOn it.',
  'strips snake_case fake tool tags'
);
assert.equal(
  cleanNarrativeText(
    'Calling tools.\n\n<tool_call>\ntranscribe_video\n</tool_call>\n\nDone.'
  ),
  'Calling tools.\n\nDone.',
  'strips tool_call blocks'
);
assert.equal(
  cleanNarrativeText('Please run `scaffold_talking_head_project` next.'),
  'Please run next.',
  'strips backtick-only snake_case tool names'
);

console.log('cleanNarrativeText.selfcheck: ok');
