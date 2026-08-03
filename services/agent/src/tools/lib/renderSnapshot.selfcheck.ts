/**
 * Self-check: renderSnapshot → draft metadata mapping + restore parse.
 * Run: npx tsx src/tools/lib/renderSnapshot.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  draftMetadataFromRenderSnapshot,
  parseRestoreRecipe,
  type RenderSnapshot,
} from './renderSnapshot.ts';

const snap: RenderSnapshot = {
  orientation: 'vertical',
  speaker_video_url: 'https://x/speaker.mp4',
  speaker_audio_url: null,
  manim_clips: [
    {
      concept_name: 'Foo',
      clip_url: 'https://x/manim_Foo.mp4',
      start_seconds: 1,
      end_seconds: 5,
    },
  ],
  transcript_words: [{ word: 'hi', start: 0, end: 0.5 }],
  total_duration: 10,
  segments_plan: {
    segments: [{ start: 0, end: 10, mode: 'C' }],
    total_duration: 10,
  },
  composition_manifest_url: 'https://x/COMPOSITION_MANIFEST.json',
  brand_colors: { primary: '#f97316', accent: '#fb923c', bg_dark: '#0a0a0a' },
  scaffoldedAt: '2026-01-01T00:00:00.000Z',
};

const meta = draftMetadataFromRenderSnapshot(snap);
assert.ok(meta);
assert.equal(meta.orientation, 'vertical');
assert.equal(meta.speaker_video_url, 'https://x/speaker.mp4');
assert.equal(meta.speaker_audio_url, undefined, 'null audio omitted');
assert.deepEqual(meta.manim_clips, snap.manim_clips);
assert.equal(meta.composition_manifest_url, snap.composition_manifest_url);

assert.equal(draftMetadataFromRenderSnapshot(undefined), undefined);
assert.equal(draftMetadataFromRenderSnapshot({} as RenderSnapshot), undefined);

const recipe = parseRestoreRecipe(meta);
assert.equal(recipe.orientation, 'vertical');
assert.equal(recipe.speaker_video_url, 'https://x/speaker.mp4');

let threw = false;
try {
  parseRestoreRecipe({});
} catch (e) {
  threw = true;
  assert.match(String(e), /incomplete|pre-snapshot/i);
}
assert.ok(threw);

console.log('renderSnapshot.selfcheck: ok');
