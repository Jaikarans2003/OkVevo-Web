/**
 * Ordered self-check for manimGuard.
 * Run: npx tsx src/tools/lib/manimGuard.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { assertManimMaxVisible, isManimScriptPath } from './manimGuard.ts';

const TRACKER_REMOVED =
  'Anti-overlap tracking (VisibleTracker) was removed from this script — it must remain wired in; fix the layout, don\'t delete the safety check.';

assert.equal(assertManimMaxVisible('print("hi")'), null, 'no MAX_VISIBLE, no Scene → ok');
assert.equal(assertManimMaxVisible('MAX_VISIBLE = 6\n'), null, 'exactly 6, no Scene → ok');
assert.equal(
  typeof assertManimMaxVisible('MAX_VISIBLE = 20\n'),
  'string',
  'raised → error'
);
assert.equal(
  typeof assertManimMaxVisible('MAX_VISIBLE = 8\n'),
  'string',
  '8 → error'
);

const sceneOnly = 'class SceneFoo(Scene):\n    def construct(self):\n        pass\n';
assert.equal(
  assertManimMaxVisible(sceneOnly),
  TRACKER_REMOVED,
  'Scene without tracker → deletion message'
);

const sceneNoCheck =
  'class VisibleTracker:\n    pass\nclass SceneFoo(Scene):\n    def construct(self):\n        pass\n';
assert.equal(
  assertManimMaxVisible(sceneNoCheck),
  TRACKER_REMOVED,
  'Scene with VisibleTracker but no .check( → deletion message'
);

const sceneWired =
  'class VisibleTracker:\n    def check(self):\n        pass\nclass SceneFoo(Scene):\n    def construct(self):\n        tracker = VisibleTracker()\n        tracker.check()\n';
assert.equal(assertManimMaxVisible(sceneWired), null, 'Scene with tracker + .check() → ok');

assert.ok(
  isManimScriptPath('/tmp/okvevo/sess/manim_scripts/Foo.py'),
  'manim_scripts path'
);
assert.equal(
  isManimScriptPath('/tmp/okvevo/sess/other/Foo.py'),
  false,
  'non-manim path'
);

console.log('manimGuard.selfcheck: ok');
