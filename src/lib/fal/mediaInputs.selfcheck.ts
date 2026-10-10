/**
 * Media-input contract: only drama-upload:// and fal.media URLs classify;
 * per-endpoint schema limits fail before any hold with an upgrade named;
 * kind mismatches and foreign URLs rejected. Run: npx tsx src/lib/fal/mediaInputs.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  classifyMediaValue,
  payloadMediaEntries,
  pickMediaArgs,
  validateAndBuildMedia,
  type MediaEntry,
} from '@/lib/fal/mediaInputs';

const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

assert.deepEqual(
  pickMediaArgs({ prompt: 'x', image_urls: [`drama-upload://${UUID}`], run_id: 'r' }),
  { image_urls: [`drama-upload://${UUID}`] }
);

// Classification.
assert.deepEqual(classifyMediaValue(`drama-upload://${UUID}`), { kind: 'upload', id: UUID });
assert.deepEqual(classifyMediaValue('https://v3b.fal.media/files/x.mp4'), {
  kind: 'fal',
  url: 'https://v3b.fal.media/files/x.mp4',
});
assert.deepEqual(classifyMediaValue('https://fal.media/files/x.mp4'), {
  kind: 'fal',
  url: 'https://fal.media/files/x.mp4',
});
for (const bad of [
  'https://example.com/a.mp4',
  'http://v3b.fal.media/x.mp4',
  'data:image/png;base64,AAA',
  '/tmp/local.png',
  'drama-upload://not-a-uuid',
  42,
  '',
]) {
  const r = classifyMediaValue(bad);
  assert.equal(typeof r, 'string', `expected rejection for ${String(bad)}`);
}

const img = (w = 1024, h = 1024): MediaEntry => ({ key: 'image_urls', measured: { kind: 'image', width: w, height: h } });
const vid = (seconds: number): MediaEntry => ({ key: 'video_urls', measured: { kind: 'video', seconds } });
const aud = (seconds: number): MediaEntry => ({ key: 'audio_urls', measured: { kind: 'audio', seconds } });

// Seedance 2.5 reference: full house within limits.
const ok25 = validateAndBuildMedia(
  'bytedance/seedance-2.5/reference-to-video',
  [...Array.from({ length: 3 }, () => vid(5)), ...Array.from({ length: 30 }, () => img()), aud(10)],
  { duration: 5 }
);
assert.ok('media' in ok25);
assert.equal(ok25.media.videos.length, 3);
assert.equal(ok25.media.images.length, 30);
assert.equal(ok25.media.audios.length, 1);

// Total cap: on 2.0 the per-kind caps (9+3+3=15) exceed the 12-file total,
// so 13 files under every per-kind cap still fail; the error names the limit.
const tooMany = validateAndBuildMedia(
  'bytedance/seedance-2.0/reference-to-video',
  [...Array.from({ length: 9 }, () => img()), vid(2), vid(2), vid(2), aud(2)],
  {}
);
assert.ok('error' in tooMany && /12/.test(tooMany.error));
assert.ok(
  'error' in
    validateAndBuildMedia(
      'bytedance/seedance-2.5/reference-to-video',
      Array.from({ length: 31 }, () => img()),
      {}
    )
);

// Per-video and combined duration bounds.
assert.ok(
  'error' in validateAndBuildMedia('bytedance/seedance-2.5/reference-to-video', [vid(31)], {})
);
assert.ok(
  'error' in
    validateAndBuildMedia('bytedance-2.5/x'.replace('bytedance-2.5/x', 'bytedance/seedance-2.5/reference-to-video'), [vid(20), vid(20)], {})
);

// Seedance 2.0 reference caps are tighter and the error names 2.5.
const over20 = validateAndBuildMedia(
  'bytedance/seedance-2.0/reference-to-video',
  [vid(4), vid(4), vid(4), vid(4)],
  {}
);
assert.ok('error' in over20 && /seedance-2\.5/.test(over20.error));
const sum20 = validateAndBuildMedia(
  'bytedance/seedance-2.0/reference-to-video',
  [vid(8), vid(8)],
  {}
);
assert.ok('error' in sum20 && /15s or less/.test(sum20.error));
// 2.0 audio needs an image or video alongside.
assert.ok(
  'error' in validateAndBuildMedia('bytedance/seedance-2.0/reference-to-video', [aud(5)], {})
);
assert.ok(
  'media' in validateAndBuildMedia('bytedance/seedance-2.0/reference-to-video', [aud(5), img()], {})
);

// task is 2.5-reference only; edit/extend need a video input.
assert.ok(
  'error' in
    validateAndBuildMedia('bytedance/seedance-2.0/reference-to-video', [vid(5)], { task: 'extension' })
);
assert.ok(
  'error' in
    validateAndBuildMedia('bytedance/seedance-2.5/reference-to-video', [], { task: 'editing' })
);
assert.ok(
  'media' in
    validateAndBuildMedia('bytedance/seedance-2.5/reference-to-video', [vid(5)], {
      task: 'extension',
      duration: 5,
    })
);
assert.ok(
  'error' in
    validateAndBuildMedia('bytedance/seedance-2.5/reference-to-video', [vid(5)], { task: 'bogus' })
);

// i2v requires the first frame; wan names start_image_url.
assert.ok('error' in validateAndBuildMedia('alibaba/wan-3.0-prime/image-to-video', [], {}));
assert.ok(
  'media' in
    validateAndBuildMedia('alibaba/wan-3.0-prime/image-to-video', [
      { key: 'start_image_url', measured: { kind: 'image', width: 100, height: 100 } },
    ], {})
);

// t2v/music/speech reject media.
assert.ok(
  'error' in validateAndBuildMedia('minimax/music-3', [aud(5)], {})
);

const cloneAudio = (seconds: number): MediaEntry => ({
  key: 'audio_url',
  measured: { kind: 'audio', seconds },
});
assert.ok('error' in validateAndBuildMedia('fal-ai/minimax/voice-clone', [cloneAudio(9)], {}));
assert.ok('media' in validateAndBuildMedia('fal-ai/minimax/voice-clone', [cloneAudio(10)], {}));
assert.ok(
  'error' in
    validateAndBuildMedia('fal-ai/minimax/speech-02-hd', [cloneAudio(12)], {})
);

// Kind mismatch: a video ref in an image slot.
assert.ok(
  'error' in
    validateAndBuildMedia('openai/gpt-image-2/edit', [
      { key: 'image_urls', measured: { kind: 'video', seconds: 5 } },
    ], {})
);

// gpt edit image ceiling lives here too (rateCard re-checks).
assert.ok(
  'error' in
    validateAndBuildMedia('openai/gpt-image-2/edit', Array.from({ length: 17 }, () => img()), {})
);
assert.ok(
  'media' in
    validateAndBuildMedia('openai/gpt-image-2/edit', Array.from({ length: 16 }, () => img()), {})
);

// H3 / wan reference caps.
assert.ok(
  'error' in
    validateAndBuildMedia('minimax/h3-max/reference-to-video', [vid(2), vid(2), vid(2), vid(2)], {})
);
assert.ok(
  'error' in
    validateAndBuildMedia(
      'alibaba/wan-3.0-prime/reference-to-video',
      Array.from({ length: 6 }, () => vid(2)),
      {}
    )
);

// Payload → falMediaIndex entries.
const v = payloadMediaEntries(
  'alibaba/wan-3.0-prime/text-to-video',
  { video: { url: 'https://v3b.fal.media/files/a.mp4' }, duration: 6, seed: 1 },
  { duration: 5 }
);
assert.deepEqual(v, [
  { url: 'https://v3b.fal.media/files/a.mp4', kind: 'video', seconds: 6, width: undefined, height: undefined },
]);
const sd = payloadMediaEntries(
  'bytedance/seedance-2.5/reference-to-video',
  { video: { url: 'https://v3b.fal.media/files/b.mp4' } },
  { duration: 8 }
);
assert.equal(sd[0].seconds, 8); // requested duration fallback (seedance bills requested)
const gpt = payloadMediaEntries('openai/gpt-image-2/edit', { images: [{ url: 'https://v3b.fal.media/files/c.png', width: 1024, height: 1024 }] }, {});
assert.equal(gpt[0].kind, 'image');
assert.equal(gpt[0].width, 1024);
const mus = payloadMediaEntries('minimax/music-3', { audio: { url: 'https://v3b.fal.media/files/d.wav' }, duration: 62 }, {});
assert.deepEqual(mus, [{ url: 'https://v3b.fal.media/files/d.wav', kind: 'audio', seconds: 62 }]);
const tts = payloadMediaEntries('fal-ai/minimax/speech-02-hd', { audio: { url: 'https://v3b.fal.media/files/e.mp3' }, duration_ms: 2100 }, {});
assert.equal(tts[0].seconds, 2.1);

console.log('mediaInputs.selfcheck: ok');
