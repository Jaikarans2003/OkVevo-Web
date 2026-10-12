/**
 * Capture charge + applyCapture vectors. No live Fal.
 * Run: npx tsx src/lib/fal/capture.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { applyCapture, applyReconcile, applyReserve } from '@/lib/gateway/reserve';
import { creditsFromUsd } from '@/lib/gateway/pricing';
import {
  billingEventsFrom,
  captureCharge,
  captureLagMs,
  falCreditsFromUsd,
  pickEvent,
  shouldSetCapturedFalse,
} from '@/lib/fal/capture';

// Live response shape (okvevo-testing, 2026-10-12, G3 job 1).
const live = {
  billing_events: [
    { timestamp: '2026-10-12T17:22:12.878305000Z', cost_total: 0.006, request_id: '01a13122-c0c8-7e52-8f6b-b48e9b5b40ab' },
  ],
  next_cursor: null,
  has_more: false,
};
assert.equal(pickEvent(billingEventsFrom(live), '01a13122-c0c8-7e52-8f6b-b48e9b5b40ab')?.cost_total, 0.006);
assert.deepEqual(billingEventsFrom({ items: live.billing_events }), []);
assert.deepEqual(billingEventsFrom(null), []);

const ev = pickEvent(
  [
    { request_id: 'other', cost_total: 9 },
    { request_id: 'abc', cost_total: 0.4, timestamp: '2026-10-10T00:10:00Z' },
  ],
  'abc'
);
assert.equal(ev?.cost_total, 0.4);
assert.equal(pickEvent([{ request_id: 'abc', cost_total: 0 }], 'abc'), null);
assert.equal(pickEvent([{ request_id: 'abc', cost_total: -1 }], 'abc'), null);

assert.equal(shouldSetCapturedFalse({ provider: 'fal', status: 'settled' }), true);
assert.equal(shouldSetCapturedFalse({ provider: 'openrouter', status: 'settled' }), false);
assert.equal(shouldSetCapturedFalse({ provider: 'fal', status: 'reserved' }), false);
assert.equal(shouldSetCapturedFalse({ provider: 'fal', status: 'settled', captured: false }), false);
assert.equal(shouldSetCapturedFalse({ provider: 'fal', status: 'settled', captured: true }), false);
assert.equal(shouldSetCapturedFalse(undefined), false);
const backfillSrc = readFileSync(
  path.join(import.meta.dirname, '..', '..', '..', 'scripts', 'backfill-captured-false.ts'),
  'utf8'
);
assert.ok(backfillSrc.includes("where('provider', '==', 'fal')"), 'backfill must filter provider == fal');
assert.ok(backfillSrc.includes('runTransaction'), 'backfill must re-read inside a transaction');
assert.ok(backfillSrc.includes('shouldSetCapturedFalse'), 'backfill must skip when captured is already set');
assert.equal(backfillSrc.includes('db.batch('), false, 'backfill must not batch-write over a newer captured flag');

const jobSrc = readFileSync(path.join(import.meta.dirname, '..', '..', '..', 'scripts', 'fal-capture-job.ts'), 'utf8');
assert.ok(jobSrc.includes("where('captured', '==', false)"), 'capture job must query uncaptured rows');
assert.ok(jobSrc.includes('captureCreditsOn'), 'capture job must re-read the job via captureCreditsOn');
assert.ok(jobSrc.includes('billingEventsFrom(await res.json())'), 'capture job must parse billing_events');
const infraSrc = readFileSync(path.join(import.meta.dirname, '..', '..', '..', 'scripts', 'drama-infra.sh'), 'utf8');
assert.ok(infraSrc.includes('must be exactly'), 'billing-key IAM must require an exact accessor set');

assert.equal(falCreditsFromUsd(0.4), creditsFromUsd(0.4).credits);
assert.equal(falCreditsFromUsd(0), 0);

const under = captureCharge(0.4, 1000);
assert.equal(under.falCredits, creditsFromUsd(0.4).credits);
assert.equal(under.finalCredits, under.falCredits);
assert.equal(under.overReserve, false);

const over = captureCharge(10, 100);
assert.equal(over.finalCredits, 100);
assert.equal(over.overReserve, true);
assert.ok(over.falCredits > 100);

const reserved = applyReserve(
  { allocationBalance: 2000, topUpBalance: 0 },
  undefined,
  1000,
  'u',
  'fal'
);
assert.equal(reserved.ok, true);
if (!reserved.ok) throw new Error('unreachable');
const settled = applyReconcile(reserved.balances, { ...reserved.job, status: 'submitted' }, 800);
assert.equal(settled.skipped, false);
if (settled.skipped) throw new Error('unreachable');

const captured = applyCapture(
  settled.balances,
  { ...reserved.job, status: 'settled', settledCredits: 800, heldAllocation: 800, heldTopUp: 0 },
  600
);
assert.equal(captured.skipped, false);
if (captured.skipped) throw new Error('unreachable');
assert.equal(captured.refund, 200);
assert.equal(captured.settledCredits, 600);
assert.equal(captured.overReserve, false);
assert.equal(captured.balances.allocationBalance, settled.balances.allocationBalance + 200);

const again = applyCapture(captured.balances, { ...reserved.job, status: 'settled', captured: true }, 600);
assert.equal(again.skipped, true);

const absorb = applyCapture(
  settled.balances,
  { ...reserved.job, status: 'settled', settledCredits: 800, heldAllocation: 800, heldTopUp: 0 },
  5000
);
assert.equal(absorb.skipped, false);
if (absorb.skipped) throw new Error('unreachable');
assert.equal(absorb.overReserve, true);
assert.equal(absorb.settledCredits, 800);
assert.equal(absorb.refund, 0);

assert.equal(captureLagMs(Date.parse('2026-10-10T00:00:00Z'), '2026-10-10T00:12:00Z'), 12 * 60 * 1000);

console.log('capture.selfcheck: ok');
