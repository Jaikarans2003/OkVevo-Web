/**
 * Capture charge + applyCapture vectors. No live Fal.
 * Run: npx tsx src/lib/fal/capture.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { applyCapture, applyReconcile, applyReserve } from '@/lib/gateway/reserve';
import { creditsFromUsd } from '@/lib/gateway/pricing';
import { captureCharge, captureLagMs, falCreditsFromUsd, pickEvent } from '@/lib/fal/capture';

const ev = pickEvent(
  [
    { request_id: 'other', cost_total: 9 },
    { request_id: 'abc', cost_total: 0.4, timestamp: '2026-10-10T00:10:00Z' },
  ],
  'abc'
);
assert.equal(ev?.cost_total, 0.4);

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
const settled = applyReconcile(reserved.balances, reserved.job, 800);
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
