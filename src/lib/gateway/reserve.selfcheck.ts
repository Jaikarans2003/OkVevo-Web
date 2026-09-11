/**
 * Two-bucket FIFO reserve/reconcile + month clamp.
 * Run: npx tsx src/lib/gateway/reserve.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  applyReconcile,
  applyRelease,
  applyReserve,
  omitUndefined,
  type JobRecord,
} from './reserve.ts';
import {
  addOneMonthClamped,
  refreshAllocationIfDue,
} from '../billing/allocation.ts';
import { Timestamp } from 'firebase-admin/firestore';

const uid = 'u1';

// Plan: alloc 100, topUp 50, spend 120 → 0 + 30
const fifo = applyReserve(
  { allocationBalance: 100, topUpBalance: 50 },
  undefined,
  120,
  uid,
  'openrouter'
);
assert.equal(fifo.ok, true);
if (!fifo.ok) throw new Error('unreachable');
assert.equal(fifo.balances.allocationBalance, 0);
assert.equal(fifo.balances.topUpBalance, 30);
assert.equal(fifo.job.heldAllocation, 100);
assert.equal(fifo.job.heldTopUp, 20);

const short = applyReserve(
  { allocationBalance: 10, topUpBalance: 5 },
  undefined,
  20,
  uid,
  'openrouter'
);
assert.equal(short.ok, false);

const dup = applyReserve(
  { allocationBalance: 100, topUpBalance: 50 },
  fifo.job,
  10,
  uid,
  'openrouter'
);
assert.equal(dup.ok, false);

const jobs = new Map<string, JobRecord>();
let balances = { allocationBalance: 50, topUpBalance: 0 };
const a = applyReserve(balances, jobs.get('a'), 40, uid, 'fal');
assert.equal(a.ok, true);
if (!a.ok) throw new Error('unreachable');
balances = a.balances;
jobs.set('a', a.job);
const b = applyReserve(balances, jobs.get('b'), 40, uid, 'fal');
assert.equal(b.ok, false);

const settled = applyReconcile(balances, a.job, 10);
assert.equal(settled.skipped, false);
if (settled.skipped) throw new Error('unreachable');
assert.equal(settled.debitAmount, 10);
// start 50, reserve 40 → alloc 10. actual 10: restore → 50, re-hold 10 → 40.
assert.equal(settled.balances.allocationBalance, 40);
assert.equal(settled.balances.topUpBalance, 0);

const over = applyReconcile(
  { allocationBalance: 0, topUpBalance: 10 },
  { ...a.job, heldAllocation: 40, heldTopUp: 0 },
  55
);
assert.equal(over.skipped, false);
if (over.skipped) throw new Error('unreachable');
assert.equal(over.balances.allocationBalance, 0);
assert.equal(over.balances.topUpBalance, 0);
assert.equal(over.debitAmount, 55); // ledger billed; balances clamped

const released = applyRelease(
  { allocationBalance: 0, topUpBalance: 30 },
  fifo.job
);
assert.equal(released.skipped, false);
if (released.skipped) throw new Error('unreachable');
assert.equal(released.balances.allocationBalance, 100);
assert.equal(released.balances.topUpBalance, 50);

const already = { ...a.job, status: 'settled' as const };
assert.equal(applyReconcile(balances, already, 5).skipped, true);
assert.equal(applyRelease(balances, already).skipped, true);

const zero = applyReserve(
  { allocationBalance: 5, topUpBalance: 0 },
  undefined,
  0,
  uid,
  'tavily'
);
assert.equal(zero.ok, true);

const falTxn = omitUndefined({
  uid,
  type: 'debit',
  amount: 12,
  provider: 'fal',
  model: 'fal-ai/flux-2/klein/9b',
  promptTokens: undefined,
  completionTokens: undefined,
  costUsd: 0.012,
});
assert.equal('promptTokens' in falTxn, false);
assert.equal('completionTokens' in falTxn, false);
assert.ok(Object.values(falTxn).every((v) => v !== undefined));

// addOneMonthClamped: Jan 31 → Feb 28 (non-leap)
const jan31 = new Date(Date.UTC(2025, 0, 31, 12, 0, 0));
const feb = addOneMonthClamped(jan31);
assert.equal(feb.getUTCFullYear(), 2025);
assert.equal(feb.getUTCMonth(), 1);
assert.equal(feb.getUTCDate(), 28);

const jan31Leap = new Date(Date.UTC(2024, 0, 31));
const febLeap = addOneMonthClamped(jan31Leap);
assert.equal(febLeap.getUTCDate(), 29);

// due-gate: not due → null (no double SET)
const notDue = refreshAllocationIfDue(
  {
    planStatus: 'active',
    creditsIncluded: 20000,
    nextAllocationDate: Timestamp.fromDate(new Date(Date.now() + 86400000)),
  },
  new Date()
);
assert.equal(notDue, null);

const due = refreshAllocationIfDue(
  {
    planStatus: 'active',
    creditsIncluded: 20000,
    nextAllocationDate: Timestamp.fromDate(new Date(Date.now() - 1000)),
  },
  new Date()
);
assert.ok(due);
assert.equal(due!.allocationBalance, 20000);
assert.ok(due!.nextAllocationDate.toDate().getTime() > Date.now());

const inactive = refreshAllocationIfDue(
  {
    planStatus: 'halted',
    creditsIncluded: 20000,
    nextAllocationDate: Timestamp.fromDate(new Date(Date.now() - 1000)),
  },
  new Date()
);
assert.equal(inactive, null);

console.log('reserve.selfcheck: ok');
