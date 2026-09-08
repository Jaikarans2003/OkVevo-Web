/**
 * Reserve-then-reconcile: two parallel estimates against a balance that
 * covers one request — only the first is admitted.
 * Run: npx tsx src/lib/gateway/reserve.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { applyReconcile, applyRelease, applyReserve, type JobRecord } from './reserve.ts';

const uid = 'u1';

const first = applyReserve(100, undefined, 80, uid, 'openrouter');
assert.equal(first.ok, true);
if (!first.ok) throw new Error('unreachable');
assert.equal(first.balance, 20);

const second = applyReserve(first.balance, undefined, 80, uid, 'openrouter');
assert.equal(second.ok, false);
if (second.ok) throw new Error('unreachable');
assert.equal(second.reason, 'insufficient');

const dup = applyReserve(100, first.job, 80, uid, 'openrouter');
assert.equal(dup.ok, false);

const jobs = new Map<string, JobRecord>();
let balance = 50;
const a = applyReserve(balance, jobs.get('a'), 40, uid, 'fal');
assert.equal(a.ok, true);
if (!a.ok) throw new Error('unreachable');
balance = a.balance;
jobs.set('a', a.job);
const b = applyReserve(balance, jobs.get('b'), 40, uid, 'fal');
assert.equal(b.ok, false);

const settled = applyReconcile(balance, a.job, 10);
assert.equal(settled.skipped, false);
if (settled.skipped) throw new Error('unreachable');
assert.equal(settled.debitAmount, 10);
// start 50, reserve 40 → balance 10. actual 10: 10 + 40 - 10 = 40.
assert.equal(settled.balance, 40);

const over = applyReconcile(10, a.job, 55);
assert.equal(over.skipped, false);
if (over.skipped) throw new Error('unreachable');
assert.equal(over.balance, 0); // clamp, never negative
assert.equal(over.debitAmount, 55);

const released = applyRelease(10, a.job);
assert.equal(released.skipped, false);
if (released.skipped) throw new Error('unreachable');
assert.equal(released.balance, 50);

const already = { ...a.job, status: 'settled' as const };
assert.equal(applyReconcile(10, already, 5).skipped, true);
assert.equal(applyRelease(10, already).skipped, true);

const zero = applyReserve(5, undefined, 0, uid, 'tavily');
assert.equal(zero.ok, true);

console.log('reserve.selfcheck: ok');
