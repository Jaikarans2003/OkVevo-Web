/**
 * Rate card vectors, promo flip, bounds, settle snapshot, margin assumption.
 * Run: npx tsx src/lib/fal/rateCard.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { creditsFromUsd, PLACEHOLDER_CREDITS_PER_USD } from '@/lib/gateway/pricing';
import { applyReconcile } from '@/lib/gateway/reserve';
import {
  H3_PROMO_ENDS_AT,
  MAX_JOB_CREDITS,
  MARGIN_REVENUE_ASSUMPTION,
  priceDrift,
  realizedMargin,
  resolveRateCard,
  seedanceKTokens,
  settleFromSnapshot,
  submitPriceGate,
} from './rateCard.ts';
import { canonicalBodyHash, decideIdempotency, memorySubmit } from './idempotency.ts';
import {
  holdIsDue,
  RESERVED_ABANDONED_AFTER_MS,
  reservedHoldAbandoned,
  settleOnce,
  sweepAction,
} from './holdSweep.ts';
import { sendOpsAlert } from '@/lib/ops/alert';

const nowPromo = Date.parse('2026-10-10T00:00:00Z');
const nowRegular = Date.parse(H3_PROMO_ENDS_AT);

const seedance = resolveRateCard({
  endpoint: 'bytedance/seedance-2.0/text-to-video',
  args: { resolution: '720p', duration: 5, generate_audio: true },
  liveUnitPrice: 0.014,
  liveFetchedAtMs: nowPromo,
  nowMs: nowPromo,
});
const expectedTokens = seedanceKTokens(1280, 720, 5);
assert.equal(expectedTokens * 0.014, seedance.rawUsd);
assert.ok(Math.abs(seedance.rawUsd - 1.512) < 1e-9);
assert.equal(creditsFromUsd(seedance.rawUsd).credits, Math.ceil(seedance.rawUsd * 2 * 1000));

const h3 = resolveRateCard({
  endpoint: 'minimax/h3-max/reference-to-video',
  args: { resolution: '768p', duration: 5 },
  media: { videos: [], audios: [], images: Array.from({ length: 5 }, () => ({ width: 1024, height: 1024 })) },
  nowMs: nowRegular,
});
assert.ok(Math.abs(h3.rawUsd - 0.42048) < 1e-9);

// Deterministic vectors (sources cited in rateCard.ts).
// Seedance 2.5 reference worked example from the Fal page: 10s video input +
// 8s requested output at 720p → 388,800 tokens; ×0.0214/1k ×0.6 video-input
// multiplier ≈ $4.99.
const sdRef = resolveRateCard({
  endpoint: 'bytedance/seedance-2.5/reference-to-video',
  args: { resolution: '720p', duration: 8 },
  media: { videos: [{ seconds: 10 }], audios: [], images: [] },
  liveUnitPrice: 0.0214,
  liveFetchedAtMs: nowPromo,
  nowMs: nowPromo,
});
assert.ok(Math.abs(sdRef.rawUsd - seedanceKTokens(1280, 720, 18) * 0.0214 * 0.6) < 1e-9);
assert.ok(Math.abs(sdRef.rawUsd - 4.992192) < 1e-6);

// Same request without a video input: no ×0.6 multiplier, image refs free.
const sdRefImgs = resolveRateCard({
  endpoint: 'bytedance/seedance-2.5/reference-to-video',
  args: { resolution: '720p', duration: 8 },
  media: { videos: [], audios: [], images: [{ width: 1024, height: 1024 }] },
  liveUnitPrice: 0.0214,
  liveFetchedAtMs: nowPromo,
  nowMs: nowPromo,
});
assert.ok(Math.abs(sdRefImgs.rawUsd - seedanceKTokens(1280, 720, 8) * 0.0214) < 1e-9);

// task=editing: duration auto → billed basis is the input length (12s total).
const sdEdit = resolveRateCard({
  endpoint: 'bytedance/seedance-2.5/reference-to-video',
  args: { resolution: '720p', duration: 'auto', task: 'editing', aspect_ratio: 'auto' },
  media: { videos: [{ seconds: 6 }], audios: [], images: [] },
  liveUnitPrice: 0.0214,
  liveFetchedAtMs: nowPromo,
  nowMs: nowPromo,
});
assert.ok(Math.abs(sdEdit.rawUsd - seedanceKTokens(1280, 720, 12) * 0.0214 * 0.6) < 1e-9);

// Out-of-schema durations fail before any hold. 2.0 caps at 15; auto refused.
assert.throws(
  () =>
    resolveRateCard({
      endpoint: 'bytedance/seedance-2.0/reference-to-video',
      args: { resolution: '720p', duration: 20 },
      media: { videos: [{ seconds: 5 }], audios: [], images: [] },
      nowMs: nowPromo,
    }),
  /4\.\.15/
);
assert.throws(
  () =>
    resolveRateCard({
      endpoint: 'bytedance/seedance-2.5/text-to-video',
      args: { resolution: '720p', duration: 'auto' },
      nowMs: nowPromo,
    }),
  /duration/
);

// H3 step table: 5s 768p + 5s 24fps video → 120 frames → 32,256 tokens;
// 32,256 − 4,096 allowance = 28,160 billable × $0.02/1k.
const h3Vid = resolveRateCard({
  endpoint: 'minimax/h3-max/reference-to-video',
  args: { resolution: '768p', duration: 5 },
  media: { videos: [{ seconds: 5 }], audios: [], images: [] },
  nowMs: nowRegular,
});
assert.ok(Math.abs(h3Vid.rawUsd - (0.4 + (28160 / 1000) * 0.02)) < 1e-9);

// H3 between steps rounds up: 3s video = 72 frames → 120-frame step.
const h3Between = resolveRateCard({
  endpoint: 'minimax/h3-max/reference-to-video',
  args: { resolution: '480p', duration: 5 },
  media: { videos: [{ seconds: 3 }], audios: [], images: [] },
  nowMs: nowRegular,
});
assert.ok(Math.abs(h3Between.rawUsd - (0.25 + ((12480 - 4096) / 1000) * 0.02)) < 1e-9);

// H3 audio tokens round up per second: 3.2s → 4 × 80 = 320 tokens (inside allowance).
const h3Audio = resolveRateCard({
  endpoint: 'minimax/h3-max/reference-to-video',
  args: { resolution: '768p', duration: 5 },
  media: { videos: [], audios: [{ seconds: 3.2 }], images: [] },
  nowMs: nowRegular,
});
assert.equal(h3Audio.rawUsd, 0.4);

// GPT edit: table cell includes ONE input image; 16 refs is the schema max.
const gptEdit = resolveRateCard({
  endpoint: 'openai/gpt-image-2/edit',
  args: { image_size: '1024x1024', quality: 'high', prompt: 'a'.repeat(100) },
  media: { videos: [], audios: [], images: [{ width: 1024, height: 1024 }] },
  nowMs: nowPromo,
});
assert.ok(Math.abs(gptEdit.rawUsd - (0.219 + 50 * (5 / 1e6))) < 1e-9);
const gptEdit16 = resolveRateCard({
  endpoint: 'openai/gpt-image-2/edit',
  args: { image_size: '1024x1024', quality: 'high', prompt: 'x' },
  media: { videos: [], audios: [], images: Array.from({ length: 16 }, () => ({ width: 1024, height: 1024 })) },
  nowMs: nowPromo,
});
assert.ok(Math.abs(gptEdit16.rawUsd - (0.219 + 15 * 0.016 + 5 / 1e6)) < 1e-9);
assert.throws(
  () =>
    resolveRateCard({
      endpoint: 'openai/gpt-image-2/edit',
      args: { image_size: '1024x1024', quality: 'high', prompt: 'x' },
      media: { videos: [], audios: [], images: Array.from({ length: 17 }, () => ({ width: 1, height: 1 })) },
      nowMs: nowPromo,
    }),
  /at most 16/
);
assert.throws(
  () =>
    resolveRateCard({
      endpoint: 'openai/gpt-image-2/edit',
      args: { image_size: '1024x1024', quality: 'high', prompt: 'x' },
      nowMs: nowPromo,
    }),
  /at least one reference image/
);

const image = resolveRateCard({
  endpoint: 'openai/gpt-image-2',
  args: { image_size: '1024x1024', quality: 'high' },
  nowMs: nowPromo,
});
assert.equal(image.rawUsd, 0.211);

const speech = resolveRateCard({
  endpoint: 'fal-ai/minimax/speech-02-hd',
  args: { text: 'a'.repeat(1000) },
  liveUnitPrice: 0.1,
  liveFetchedAtMs: nowPromo,
  nowMs: nowPromo,
});
assert.equal(speech.rawUsd, 0.1);

const clonePreview = 'This is a short preview of the cloned voice.';
const clone = resolveRateCard({
  endpoint: 'fal-ai/minimax/voice-clone',
  args: { text: clonePreview },
  nowMs: nowPromo,
});
assert.ok(Math.abs(clone.rawUsd - (1.5 + (clonePreview.length / 1000) * 0.3)) < 1e-9);

const music = resolveRateCard({
  endpoint: 'minimax/music-3',
  args: { duration: 60 },
  liveUnitPrice: 0.002,
  liveFetchedAtMs: nowPromo,
  nowMs: nowPromo,
});
assert.equal(music.rawUsd, 0.12);

const promo = resolveRateCard({
  endpoint: 'minimax/h3-max/text-to-video',
  args: { resolution: '768p', duration: 5 },
  nowMs: nowPromo,
});
assert.equal(promo.rawUsd, 0.048 * 5);
const regular = resolveRateCard({
  endpoint: 'minimax/h3-max/text-to-video',
  args: { resolution: '768p', duration: 5 },
  nowMs: nowRegular,
});
assert.equal(regular.rawUsd, 0.08 * 5);

const badLive = resolveRateCard({
  endpoint: 'minimax/music-3',
  args: { duration: 60 },
  liveUnitPrice: 0,
  liveFetchedAtMs: nowPromo,
  nowMs: nowPromo,
});
assert.equal(badLive.rawUsd, 0.12);
assert.ok(badLive.alert);

const outage = resolveRateCard({
  endpoint: 'fal-ai/minimax/speech-02-hd',
  args: { text: 'hi' },
  liveUnitPrice: null,
  nowMs: nowPromo,
});
assert.equal(outage.rawUsd, 0.1 * (2 / 1000));
assert.ok(outage.rawUsd > 0);

const wan = resolveRateCard({
  endpoint: 'alibaba/wan-3.0-prime/text-to-video',
  args: { resolution: '720p', duration: 5 },
  liveUnitPrice: 9,
  liveFetchedAtMs: nowPromo,
  nowMs: nowPromo,
});
assert.equal(wan.rawUsd, 0.14 * 5);
assert.equal(wan.snapshot.source, 'card');

const settled = settleFromSnapshot({
  snapshot: music.snapshot,
  args: { duration: 300 },
  payload: { duration: 60 },
  nowMs: nowPromo + 60_000,
});
assert.equal(settled, 0.12);

for (const sample of [seedance, h3, image, speech, music]) {
  const credits = creditsFromUsd(sample.rawUsd).credits;
  assert.ok(credits >= sample.rawUsd * 2 * PLACEHOLDER_CREDITS_PER_USD);
  assert.ok(sample.rawUsd > 0);
}

assert.equal(MAX_JOB_CREDITS, 70_000);
assert.ok(creditsFromUsd(34.92).credits <= MAX_JOB_CREDITS);

const higher = creditsFromUsd(1).credits;
assert.ok(higher + 1 > higher);

const drift = priceDrift({
  nowMs: Date.parse('2026-10-13T00:00:00Z'),
  liveByEndpoint: { 'minimax/music-3': 0.002, 'fal-ai/minimax/speech-02-hd': 0.2 },
});
assert.ok(drift.some((line) => line.endpoint === 'minimax/h3-max' && line.note.includes('promo')));
assert.ok(drift.some((line) => line.endpoint.startsWith('alibaba/') && line.note.includes('cannot express')));
assert.ok(drift.some((line) => line.endpoint === 'fal-ai/minimax/speech-02-hd' && line.level === 'HIGH'));

assert.equal(PLACEHOLDER_CREDITS_PER_USD, 1000);
assert.match(MARGIN_REVENUE_ASSUMPTION, /ASSUMPTION/);
const margin = realizedMargin(0.5, 2000);
assert.ok(margin != null && Math.abs(margin - 0.75) < 1e-9);

const hashA = canonicalBodyHash({ endpoint: 'minimax/music-3', duration: 60 });
const hashB = canonicalBodyHash({ duration: 60, endpoint: 'minimax/music-3' });
assert.equal(hashA, hashB);
assert.equal(decideIdempotency(undefined, hashA).action, 'create');
assert.equal(
  decideIdempotency(
    {
      uid: 'u',
      runId: 'r',
      bodyHash: 'other',
      phase: 'reserved',
      submitStarted: false,
      holdId: 'h',
    },
    hashA
  ).action,
  'conflict'
);

const store = new Map();
let calls = 0;
const first = memorySubmit({
  store,
  key: 'u:r',
  uid: 'u',
  runId: 'r',
  bodyHash: hashA,
  fal: () => {
    calls += 1;
    return 'fal-1';
  },
});
const second = memorySubmit({
  store,
  key: 'u:r',
  uid: 'u',
  runId: 'r',
  bodyHash: hashA,
  fal: () => {
    calls += 1;
    return 'fal-2';
  },
});
assert.equal(calls, 1);
assert.equal(first.holds, 1);
assert.equal(second.falCalls, 1);
assert.equal(second.falRequestId, 'fal-1');

const crashed = new Map();
let resubmits = 0;
memorySubmit({
  store: crashed,
  key: 'u:c',
  uid: 'u',
  runId: 'c',
  bodyHash: hashA,
  fal: () => '',
});
memorySubmit({
  store: crashed,
  key: 'u:c',
  uid: 'u',
  runId: 'c',
  bodyHash: hashA,
  fal: () => {
    resubmits += 1;
    return 'nope';
  },
});
assert.equal(resubmits, 0);

assert.equal(sweepAction('IN_PROGRESS'), 'leave');
assert.equal(sweepAction('COMPLETED'), 'settle');
assert.equal(sweepAction('weird'), 'alert');
assert.equal(holdIsDue(0, 6 * 60 * 60 * 1000), true);
// reservedHoldAbandoned: 30-minute assumption, alert only when no Fal id.
assert.equal(reservedHoldAbandoned(0, RESERVED_ABANDONED_AFTER_MS, undefined), true);
assert.equal(reservedHoldAbandoned(0, RESERVED_ABANDONED_AFTER_MS - 1, undefined), false);
assert.equal(reservedHoldAbandoned(0, RESERVED_ABANDONED_AFTER_MS * 10, 'req-1'), false);
assert.equal(reservedHoldAbandoned(0, RESERVED_ABANDONED_AFTER_MS * 10, ''), true);
assert.equal(reservedHoldAbandoned(0, RESERVED_ABANDONED_AFTER_MS * 10, null), true);

const race = {
  settled: false,
  balances: { allocationBalance: 0, topUpBalance: 0 },
  job: {
    uid: 'u',
    provider: 'fal' as const,
    estimatedCredits: 100,
    status: 'submitted' as const,
    heldAllocation: 100,
    heldTopUp: 0,
  },
};
assert.equal(settleOnce(race, 80), true);
assert.equal(settleOnce(race, 80), false);
assert.equal(race.job.status, 'settled');
const skipped = applyReconcile(race.balances, race.job, 80);
assert.equal(skipped.skipped, true);

// Alert contract (full coverage in src/lib/ops/alert.selfcheck.ts): HIGH
// dedupes per (condition, id, UTC day); every send leaves an opsAlerts record
// and one structured log line.
const mem = new Map<string, import('@/lib/ops/alert').AlertRecord>();
const logLines: string[] = [];
const alertStore = { has: (k: string) => mem.has(k), set: (k: string, r: never) => void mem.set(k, r) };
const high = await sendOpsAlert(
  { severity: 'HIGH', condition: 'price-drift', id: 'music', text: 'card below live' },
  { nowMs: nowPromo, store: alertStore, log: (l) => logLines.push(l) }
);
const again = await sendOpsAlert(
  { severity: 'HIGH', condition: 'price-drift', id: 'music', text: 'card below live' },
  { nowMs: nowPromo, store: alertStore, log: (l) => logLines.push(l) }
);
assert.equal(high, 'sent');
assert.equal(again, 'deduped');
assert.equal(logLines.length, 1);
assert.equal(JSON.parse(logLines[0]).severity, 'HIGH');

// submitPriceGate truth table — a refusal is decided from inputs only, so it
// runs before any reserve and can never leave a hold.
assert.equal(submitPriceGate(500, 400, 'run-1'), 'price_exceeded');
assert.equal(submitPriceGate(400, 400, 'run-1'), 'ok');
assert.equal(submitPriceGate(300, 400, 'run-1'), 'ok');
assert.equal(submitPriceGate(500, null, 'run-1'), 'approved_required');
assert.equal(submitPriceGate(500, null, ''), 'approved_required');
assert.equal(submitPriceGate(500, 500, ''), 'approved_required');

console.log('rateCard.selfcheck: ok');
