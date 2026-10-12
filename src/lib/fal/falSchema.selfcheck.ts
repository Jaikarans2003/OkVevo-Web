/**
 * Fal request contract guard. Run: npx tsx src/lib/fal/falSchema.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { falBodyErrors, PINNED_SCHEMAS, schemaDrift } from './falSchema.ts';
import { RATE_CARD_IDS } from './rateCard.ts';

const U = 'https://v3b.fal.media/files/x.png';

for (const id of RATE_CARD_IDS) {
  const pinned = PINNED_SCHEMAS[id];
  assert.ok(pinned, `rate-card id ${id} has no pinned schema`);
  assert.equal(pinned.endpoint_id, id);
  assert.ok(!Number.isNaN(Date.parse(pinned.fetched_at)), `${id} fetched_at`);
}

const fields = (endpoint: string, body: Record<string, unknown>) =>
  falBodyErrors(endpoint, body).map((e) => e.field);

// G3 job 1 as the old adapter sent it: no prompt, image_size "1024x1024".
const g3 = fields('openai/gpt-image-2', { quality: 'low', image_size: '1024x1024', num_images: 1 });
assert.ok(g3.includes('prompt'), 'missing prompt must be reported');
assert.ok(g3.includes('image_size'), 'string WxH image_size must be rejected');

// One valid final body per rate-card endpoint (what the fixed adapter sends).
const valid: Record<string, Record<string, unknown>> = {
  'bytedance/seedance-2.0/text-to-video': { prompt: 'p', duration: '5', resolution: '720p', generate_audio: true },
  'bytedance/seedance-2.0/image-to-video': { prompt: 'p', image_url: U, duration: '5', resolution: '480p', generate_audio: true },
  'bytedance/seedance-2.0/reference-to-video': { prompt: 'p', image_urls: [U], duration: '4', resolution: '720p', generate_audio: false },
  'bytedance/seedance-2.5/text-to-video': { prompt: 'p', duration: '5', resolution: '720p', generate_audio: true, aspect_ratio: '9:16' },
  'bytedance/seedance-2.5/image-to-video': { prompt: 'p', image_url: U, end_image_url: U, duration: '5', resolution: '720p', generate_audio: true },
  'bytedance/seedance-2.5/reference-to-video': { prompt: 'p', video_urls: [U], task: 'extension', duration: '5', resolution: '720p', generate_audio: true },
  'minimax/h3-max/text-to-video': { prompt: 'p', prompt_expansion_mode: 'balanced', duration: 5, resolution: '768P', aspect_ratio: '16:9' },
  'minimax/h3-max/image-to-video': { prompt: 'p', prompt_expansion_mode: 'balanced', image_url: U, duration: 5, resolution: '480P' },
  'minimax/h3-max/reference-to-video': { prompt: 'p', prompt_expansion_mode: 'balanced', reference_image_urls: [U], duration: 5, resolution: '768P' },
  'alibaba/wan-3.0-prime/text-to-video': { prompt: 'p', duration: 5, resolution: '720p', audio: true },
  'alibaba/wan-3.0-prime/image-to-video': { prompt: 'p', start_image_url: U, duration: 5, resolution: '480p', audio: true },
  'alibaba/wan-3.0-prime/reference-to-video': { prompt: 'p', reference_image_urls: [U], duration: 5, resolution: '720p', audio: true },
  'openai/gpt-image-2': { prompt: 'p a', image_size: { width: 1024, height: 1024 }, quality: 'low', num_images: 1, output_format: 'png' },
  'openai/gpt-image-2/edit': { prompt: 'p a', image_urls: [U], image_size: { width: 1024, height: 1024 }, quality: 'high', num_images: 1 },
  'minimax/music-3': { prompt: 'p', lyrics: '[instrumental]', duration: 30 },
  'fal-ai/minimax/speech-02-hd': { text: 'Hello, 2 worlds.', voice_setting: { voice_id: 'Wise_Woman' }, language_boost: 'Hindi', output_format: 'url' },
  'fal-ai/minimax/voice-clone': { audio_url: U, text: 'preview', model: 'speech-02-hd' },
};
for (const id of RATE_CARD_IDS) {
  assert.ok(valid[id], `no valid sample for ${id}`);
  assert.deepEqual(falBodyErrors(id, valid[id]), [], `${id} sample must validate`);
}

// The four bugs the G3 smoke surfaced, plus the speech voice field.
assert.ok(
  fields('minimax/h3-max/text-to-video', { prompt: 'p', prompt_expansion_mode: 'balanced', resolution: '768p' }).includes('resolution'),
  'h3 resolution is case-exact'
);
assert.ok(
  fields('minimax/h3-max/text-to-video', { prompt: 'p', resolution: '768P' }).includes('prompt_expansion_mode'),
  'h3 prompt_expansion_mode is required'
);
assert.ok(
  fields('minimax/music-3', { prompt: 'p', lyrics: 'x', duration: 5, resolution: '720p' }).includes('resolution'),
  'music must not carry video fields'
);
assert.ok(
  fields('bytedance/seedance-2.5/text-to-video', { prompt: 'p', duration: 5 }).includes('duration'),
  'seedance duration is a string enum'
);
assert.ok(
  fields('fal-ai/minimax/speech-02-hd', { text: 'hi', voice_id: 'Wise_Woman' }).includes('voice_id'),
  'top-level voice_id is not a speech field (voice_setting.voice_id is)'
);
assert.deepEqual(fields('fal-ai/unknown/thing', {}), ['(endpoint)'], 'no pinned schema fails closed');

// Drift: required or enum change = HIGH; other input change = INFO.
const base = PINNED_SCHEMAS['minimax/h3-max/text-to-video'].openapi;
const clone = () => JSON.parse(JSON.stringify(base)) as typeof base;
assert.deepEqual(schemaDrift('minimax/h3-max/text-to-video', base, clone()), []);
const enumChanged = clone();
(enumChanged.components.schemas.H3MaxTextToVideoInput.properties as Record<string, { enum?: string[] }>).resolution.enum = ['480P', '768P'];
assert.equal(schemaDrift('minimax/h3-max/text-to-video', base, enumChanged)[0]?.level, 'HIGH');
const requiredChanged = clone();
(requiredChanged.components.schemas.H3MaxTextToVideoInput.required as string[]).push('seed');
assert.equal(schemaDrift('minimax/h3-max/text-to-video', base, requiredChanged)[0]?.level, 'HIGH');
const described = clone();
(described.components.schemas.H3MaxTextToVideoInput.properties as Record<string, { description?: string }>).prompt.description = 'x';
assert.deepEqual(
  schemaDrift('minimax/h3-max/text-to-video', base, described).map((l) => l.level),
  ['INFO']
);
const outputOnly = clone();
outputOnly.components.schemas.QueueStatus = { type: 'object' };
assert.deepEqual(schemaDrift('minimax/h3-max/text-to-video', base, outputOnly), [], 'non-input change is ignored');

// The guard runs before any hold.
const handler = readFileSync(path.join(import.meta.dirname, 'handleQueue.ts'), 'utf8');
const guardAt = handler.indexOf('falBodyErrors(endpoint');
assert.ok(guardAt > 0, 'handleSubmit must call falBodyErrors');
assert.ok(guardAt < handler.indexOf('reserveFalRun({'), 'schema guard must run before reserveFalRun');

console.log('falSchema.selfcheck ok');
