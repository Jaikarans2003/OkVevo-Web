/**
 * FX drift vs ₹95–100 book band; cron must never mutate plans.
 * Run: npx tsx src/lib/billing/fxDrift.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { fxDriftVsBook, shouldAlertFxDrift, topUpAmountMinorUnits } from './currency.ts';
import { evaluateFxDrift, fetchUsdInrRate } from './fxDrift.ts';

assert.equal(fxDriftVsBook(97.5), 0);
assert.equal(fxDriftVsBook(95), 0);
assert.equal(fxDriftVsBook(100), 0);
assert.equal(topUpAmountMinorUnits(10, 'INR'), 100_000);
assert.equal(topUpAmountMinorUnits(10, 'USD'), 1_000);
assert.equal(shouldAlertFxDrift(97.5), false);
assert.equal(shouldAlertFxDrift(90), false);
assert.equal(shouldAlertFxDrift(80), true);
assert.equal(shouldAlertFxDrift(105), false);
assert.equal(shouldAlertFxDrift(110), true);

const evalOk = evaluateFxDrift(97);
assert.equal(evalOk.alert, false);
const evalHi = evaluateFxDrift(120);
assert.equal(evalHi.alert, true);

const quote = await fetchUsdInrRate(async (url) => {
  const href = String(url);
  if (href.includes('open.er-api.com')) {
    return new Response(JSON.stringify({ rates: { INR: 97.2 } }), { status: 200 });
  }
  throw new Error(`unexpected ${href}`);
});
assert.equal(quote.rate, 97.2);
assert.equal(quote.source, 'open.er-api.com');

const root = path.join(import.meta.dirname, '../..');
const cron = readFileSync(path.join(root, 'app/api/cron/fx-drift/route.ts'), 'utf8');
assert.doesNotMatch(cron, /razorpay\.subscriptions/i);
assert.doesNotMatch(cron, /plan_id/);
assert.doesNotMatch(cron, /RAZORPAY_PLAN_IDS/);
assert.match(cron, /opsAlerts\/fxDrift/);
assert.match(cron, /Never auto-changes a Razorpay plan/);

console.log('fxDrift.selfcheck: ok');
