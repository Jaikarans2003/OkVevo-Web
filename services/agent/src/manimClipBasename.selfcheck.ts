/**
 * Assert manim clip version allocator (Foo.mp4 → Foo_2.mp4).
 * Run: npx tsx services/agent/src/manimClipBasename.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { nextManimClipBasename } from './manimClipBasename.ts';

assert.equal(nextManimClipBasename('Foo', []), 'Foo.mp4');
assert.equal(nextManimClipBasename('Foo', ['Bar.mp4']), 'Foo.mp4');
assert.equal(nextManimClipBasename('Foo', ['Foo.mp4']), 'Foo_2.mp4');
assert.equal(
  nextManimClipBasename('Foo', ['Foo.mp4', 'Foo_2.mp4', 'Bar.mp4']),
  'Foo_3.mp4'
);
assert.equal(
  nextManimClipBasename('Foo', ['FOO.MP4', 'foo_2.mp4']),
  'Foo_3.mp4',
  'case-insensitive taken set'
);

console.log('manimClipBasename.selfcheck: ok');
