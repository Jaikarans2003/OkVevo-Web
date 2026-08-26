/**
 * Assert {skillId}.mp4 version allocator (+ legacy final*.mp4).
 * Run: npx tsx services/agent/src/finalVideoBasename.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  FINAL_VIDEO_NAME_RE,
  nextFinalVideoBasename,
} from './finalVideoBasename.ts';

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

assert.equal(nextFinalVideoBasename([], 'talking-head'), 'talking-head.mp4');
assert.equal(
  nextFinalVideoBasename(['talking-head.mp4'], 'talking-head'),
  'talking-head_2.mp4'
);
assert.equal(
  nextFinalVideoBasename(['talking-head.mp4', 'edu-video.mp4'], 'edu-video'),
  'edu-video_2.mp4'
);
assert.equal(
  nextFinalVideoBasename(['talking-head.mp4'], 'edu-video'),
  'edu-video.mp4',
  'second skill starts at _1, not a raw runId'
);

assert.ok(FINAL_VIDEO_NAME_RE.test('final.mp4'));
assert.ok(FINAL_VIDEO_NAME_RE.test('final_2.mp4'));
assert.ok(FINAL_VIDEO_NAME_RE.test('draft_video.mp4'));
assert.ok(FINAL_VIDEO_NAME_RE.test('talking-head.mp4'));
assert.ok(FINAL_VIDEO_NAME_RE.test('edu-video_2.mp4'));
assert.ok(FINAL_VIDEO_NAME_RE.test('other-skill.mp4'));
assert.ok(FINAL_VIDEO_NAME_RE.test('other-skill_2.mp4'));
assert.ok(!FINAL_VIDEO_NAME_RE.test('foo_bar.mp4'));

console.log('finalVideoBasename.selfcheck: ok');
