/**
 * Self-check: listSessionManimClips filters manim_* minus scripts, latest URL wins.
 * Run: npx tsx src/tools/lib/sessionManimClips.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  isRenderedManimClipKind,
  listSessionManimClipsFromDocs,
  sessionManimClipFromDoc,
} from './sessionManimClips.ts';

assert.equal(isRenderedManimClipKind('manim_Foo'), true);
assert.equal(isRenderedManimClipKind('manim_script_Foo'), false);
assert.equal(isRenderedManimClipKind('composition'), false);

assert.deepEqual(sessionManimClipFromDoc({ kind: 'manim_Bar', url: 'https://x/b.mp4' }), {
  safeName: 'Bar',
  clip_url: 'https://x/b.mp4',
});
assert.equal(sessionManimClipFromDoc({ kind: 'manim_script_Bar', url: 'https://x/s.py' }), null);
assert.equal(sessionManimClipFromDoc({ kind: 'manim_Bar', url: '' }), null);

const docs = [
  {
    data: () => ({
      kind: 'manim_A',
      url: 'https://old/a.mp4',
      createdAt: 1,
    }),
  },
  {
    data: () => ({
      kind: 'manim_A',
      url: 'https://new/a.mp4',
      createdAt: 9,
    }),
  },
  {
    data: () => ({
      kind: 'manim_script_A',
      url: 'https://x/a.py',
      createdAt: 10,
    }),
  },
  {
    data: () => ({
      kind: 'manim_B',
      url: 'https://x/b.mp4',
      createdAt: 5,
    }),
  },
];

const clips = listSessionManimClipsFromDocs(docs);
assert.equal(clips.length, 2);
assert.deepEqual(
  clips.find((c) => c.safeName === 'A'),
  { safeName: 'A', clip_url: 'https://new/a.mp4' }
);
assert.deepEqual(
  clips.find((c) => c.safeName === 'B'),
  { safeName: 'B', clip_url: 'https://x/b.mp4' }
);

console.log('sessionManimClips.selfcheck: ok');
