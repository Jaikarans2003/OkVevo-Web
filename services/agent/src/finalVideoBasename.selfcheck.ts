/**
 * Assert final*.mp4 version allocator.
 * Run: npx tsx services/agent/src/finalVideoBasename.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { nextFinalVideoBasename } from './finalVideoBasename.ts';

assert.equal(nextFinalVideoBasename([]), 'final.mp4');
assert.equal(nextFinalVideoBasename(['draft_video.mp4']), 'final.mp4');
assert.equal(nextFinalVideoBasename(['final.mp4']), 'final_2.mp4');
assert.equal(
  nextFinalVideoBasename(['final.mp4', 'final_2.mp4', 'draft_video.mp4']),
  'final_3.mp4'
);
assert.equal(
  nextFinalVideoBasename(['FINAL.MP4', 'final_2.mp4']),
  'final_3.mp4',
  'case-insensitive taken set'
);

console.log('finalVideoBasename.selfcheck: ok');
