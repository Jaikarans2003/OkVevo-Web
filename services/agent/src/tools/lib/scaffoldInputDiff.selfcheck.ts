/**
 * Assert scaffold input-diff + session-latest manim URL preference.
 * Run: npx tsx services/agent/src/tools/lib/scaffoldInputDiff.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  brandColorsEqual,
  diffScaffoldInputs,
  preferSessionManimClipUrl,
} from './scaffoldInputDiff.ts';

const brand = { primary: '#f97316', accent: '#fb923c', bg_dark: '#0a0a0a' };
const brandUpper = { primary: '#F97316', accent: '#FB923C', bg_dark: '#0A0A0A' };

assert.equal(brandColorsEqual(brand, brandUpper), true, 'brand hex case-insensitive');
assert.equal(
  brandColorsEqual(brand, { ...brand, accent: '#ffffff' }),
  false
);

assert.equal(
  preferSessionManimClipUrl('https://agent/old.mp4', 'https://session/new.mp4'),
  'https://session/new.mp4',
  'session latest wins'
);
assert.equal(
  preferSessionManimClipUrl('https://agent/only.mp4', undefined),
  'https://agent/only.mp4',
  'keep agent when no session clip'
);

const sameSpeaker = diffScaffoldInputs(
  {
    orientation: 'horizontal',
    speaker_video_url: 'https://x/speaker.mp4',
    manim_clip_urls: ['https://x/a.mp4', 'https://x/b.mp4'],
    brand,
  },
  {
    orientation: 'horizontal',
    speaker_video_url: 'https://x/speaker.mp4',
    manim_clip_urls: ['https://x/a.mp4', 'https://x/b_2.mp4'],
    brand,
  }
);
assert.equal(sameSpeaker.fullMediaInvalidation, false);
assert.equal(sameSpeaker.speakerChanged, false, 'same speaker URL → skip');
assert.equal(sameSpeaker.brandChanged, false);
assert.deepEqual(sameSpeaker.manimChangedIndices, [1], 'only changed manim index');

const orient = diffScaffoldInputs(
  {
    orientation: 'horizontal',
    speaker_video_url: 'https://x/speaker.mp4',
    manim_clip_urls: ['https://x/a.mp4'],
    brand,
  },
  {
    orientation: 'vertical',
    speaker_video_url: 'https://x/speaker.mp4',
    manim_clip_urls: ['https://x/a.mp4'],
    brand,
  }
);
assert.equal(orient.fullMediaInvalidation, true, 'orientation → full media invalidate');
assert.deepEqual(orient.manimChangedIndices, [0]);

const noPrior = diffScaffoldInputs(null, {
  orientation: 'horizontal',
  speaker_video_url: 'https://x/speaker.mp4',
  manim_clip_urls: ['https://x/a.mp4'],
  brand,
});
assert.equal(noPrior.fullMediaInvalidation, true);
assert.equal(noPrior.speakerChanged, true);

console.log('scaffoldInputDiff.selfcheck: ok');
