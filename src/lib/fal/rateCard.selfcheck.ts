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
} from './rateCard.ts';
import { canonicalBodyHash, decideIdempotency, memorySubmit } from './idempotency.ts';
import { holdIsDue, settleOnce, sweepAction } from './holdSweep.ts';
import { sendOpsAlert } from '@/lib/ops/alert';
import { sendTelegram } from '@/lib/ops/telegram';

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
  args: { resolution: '768p', duration: 5, reference_image_count: 5 },
  nowMs: nowRegular,
});
assert.ok(Math.abs(h3.rawUsd - 0.42048) < 1e-9);

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

const alerts: string[] = [];
const mem = new Map();
const env = { TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' };
let telegramCalls = 0;
const fetchImpl = async (url: string) => {
  assert.ok(!String(url).includes('token') || String(url).includes('api.telegram.org'));
  telegramCalls += 1;
  alerts.push(String(url));
  return new Response('{}', { status: 200 });
};
const high = await sendOpsAlert(
  { severity: 'HIGH', condition: 'price-drift', id: 'music', text: 'card below live' },
  { nowMs: nowPromo, env, store: mem, fetchImpl: fetchImpl as typeof fetch }
);
const again = await sendOpsAlert(
  { severity: 'HIGH', condition: 'price-drift', id: 'music', text: 'card below live' },
  { nowMs: nowPromo, env, store: mem, fetchImpl: fetchImpl as typeof fetch }
);
assert.equal(high, 'sent');
assert.equal(again, 'deduped');
assert.equal(telegramCalls, 1);

const missing = await sendOpsAlert(
  { severity: 'INFO', condition: 'heartbeat', id: 'day', text: 'heartbeat' },
  { nowMs: nowPromo, env: {}, store: new Map(), fetchImpl: fetchImpl as typeof fetch }
);
assert.equal(missing, 'skipped');

let slept = 0;
let tries = 0;
const limited = await sendTelegram(
  'x'.repeat(5000),
  env,
  async () => {
    tries += 1;
    if (tries === 1) {
      return new Response(JSON.stringify({ parameters: { retry_after: 90 } }), { status: 429 });
    }
    return new Response('{}', { status: 200 });
  },
  async (ms) => {
    slept = ms;
  }
);
assert.equal(limited, 'sent');
assert.equal(slept, 30_000);

console.log('rateCard.selfcheck: ok');
