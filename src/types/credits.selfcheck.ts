/**
 * Credit types: two-bucket SoT + opaque integer platform credit unit.
 * Run: npx tsx src/types/credits.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  additionalRemainingPct,
  availableCredits,
  flooredPct,
  formatPctLabel,
  nextAllocationGrantedTotal,
  nextTopUpPurchasedTotal,
  remainingPct,
  replayAllocationGrant,
  seedAllocationGrantedTotal,
  seedTopUpPurchasedTotal,
  type CreditTransaction,
  type TransactionType,
  type UserCredits,
} from './credits.ts';

const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'credits.ts'),
  'utf8'
);

const types: TransactionType[] = ['grant', 'debit', 'refund'];
assert.deepEqual(types, ['grant', 'debit', 'refund']);

function assertNonNegInt(n: number, label: string) {
  assert.equal(Number.isInteger(n) && n >= 0, true, label);
}

const allocation: UserCredits['allocationBalance'] = 0;
const topUp: UserCredits['topUpBalance'] = 0;
const included: UserCredits['creditsIncluded'] = 0;
const amount: CreditTransaction['amount'] = 0;
assertNonNegInt(allocation, 'allocationBalance is a non-negative integer');
assertNonNegInt(topUp, 'topUpBalance is a non-negative integer');
assertNonNegInt(included, 'creditsIncluded is a non-negative integer');
assertNonNegInt(amount, 'amount is a non-negative integer');

assert.equal(remainingPct(20000, 10000), 50);
assert.equal(remainingPct(20000, 10000, 20000), 50);
assert.equal(remainingPct(0, 100), 0);
assert.equal(flooredPct(19931, 20000), 99.65);
assert.notEqual(Math.round((19931 / 20000) * 100), 99);
assert.equal(Math.round((19931 / 20000) * 100), 100);
assert.equal(flooredPct(1, 20000), 0);
assert.equal(flooredPct(20000, 20000), 100);
assert.equal(flooredPct(50, 0), 0);
assert.equal(remainingPct(60000, 59999, 60000), 99.99);
assert.equal(additionalRemainingPct(2500, 5000), 50);
assert.equal(additionalRemainingPct(5000, 0), 100);
assert.equal(additionalRemainingPct(0, 0), 0);
assert.equal(nextTopUpPurchasedTotal(0, 500, 1500), 1500);
assert.equal(nextTopUpPurchasedTotal(1000, 500, 800), 1500);
assert.equal(seedTopUpPurchasedTotal(0, 5000, 3000), 5000);
assert.equal(seedTopUpPurchasedTotal(8000, 5000, 3000), 8000);
assert.equal(availableCredits(100, 50), 150);

assert.equal(formatPctLabel(87.5), '87.5%');
assert.equal(formatPctLabel(99.86), '99.86%');
assert.equal(formatPctLabel(50), '50%');
assert.equal(formatPctLabel(100), '100%');
assert.equal(formatPctLabel(99.65), '99.65%');

assert.equal(replayAllocationGrant(0, 20000, 'set'), 20000);
assert.equal(replayAllocationGrant(20000, 60000, 'add'), 80000);
assert.equal(replayAllocationGrant(80000, 20000, undefined), 20000);
assert.equal(replayAllocationGrant(80000, 20000, 'set'), 20000);
assert.equal(seedAllocationGrantedTotal(0, 80000), 80000);
assert.equal(seedAllocationGrantedTotal(80000, 20000), 80000);
assert.notEqual(seedAllocationGrantedTotal(0, 80000), 70000);

assert.equal(nextAllocationGrantedTotal('set', 80000, 20000, 20000), 20000);
assert.equal(nextAllocationGrantedTotal('add', 20000, 60000, 70000), 80000);
assert.equal(remainingPct(20000, 20000, nextAllocationGrantedTotal('set', 0, 20000, 20000)), 100);

const afterUse = remainingPct(20000, 10000, 20000);
assert.equal(afterUse, 50);
const upiTank = nextAllocationGrantedTotal('add', 20000, 60000, 70000);
assert.equal(upiTank, 80000);
assert.equal(remainingPct(60000, 70000, upiTank), 87.5);
assert.notEqual(remainingPct(60000, 70000, upiTank), 50);
assert.notEqual(remainingPct(60000, 70000, upiTank), 100);
assert.equal(remainingPct(60000, 80000, 80000), 100);
assert.equal(remainingPct(60000, 79886, 80000), 99.85);
assert.notEqual(remainingPct(60000, 79886, 80000), 100);

const setAfterStack = nextAllocationGrantedTotal('set', 80000, 20000, 20000);
assert.equal(setAfterStack, 20000);
assert.equal(remainingPct(20000, 20000, setAfterStack), 100);

const debit = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/gateway/debit.ts'),
  'utf8'
);
assert.match(debit, /topUpPurchasedTotal/);
assert.match(debit, /nextTopUpPurchasedTotal/);
assert.match(debit, /allocationGrantedTotal/);
assert.match(debit, /nextAllocationGrantedTotal/);
assert.match(debit, /allocationGrantedTotal: nextAllocationGrantedTotal/);
assert.doesNotMatch(debit, /allocationGrantedTotal: next\.allocationBalance/);

const billingPage = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../app/billing/[[...slug]]/page.tsx'),
  'utf8'
);
assert.match(billingPage, /Plan remaining/);
assert.match(billingPage, /Additional remaining/);
assert.match(billingPage, /formatPctLabel/);
assert.doesNotMatch(billingPage, /Number\.isInteger\(pct\)/);
assert.doesNotMatch(billingPage, /Math\.round\(\(billing\?\.remainingPct/);
assert.doesNotMatch(billingPage, /billing\?\.additional \?\? 0\)\.toLocaleString/);

const seed = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/seed-allocation-granted-total.ts'),
  'utf8'
);
assert.match(seed, /seedAllocationGrantedTotal/);
assert.match(seed, /replayAllocationGrant/);
assert.doesNotMatch(seed, /seedAllocationGrantedTotal\([^)]*leftover/);
assert.doesNotMatch(seed, /Math\.max\([^)]*allocationBalance/);

assert.match(src, /platform credit unit, integer/);
assert.match(src, /allocationBalance/);
assert.match(src, /allocationGrantedTotal/);
assert.match(src, /paymentMethod\?:/);
assert.match(src, /hasScheduledChanges\?:/);
assert.match(src, /topUpBalance/);
assert.match(src, /topUpPurchasedTotal/);
assert.doesNotMatch(src, /FEATURE_COSTS|FeatureType/);
assert.doesNotMatch(src, /micros/i);
assert.doesNotMatch(src, /1_000_000/);
assert.doesNotMatch(src, /\$1\s*=/);
assert.doesNotMatch(src, /USD ratio|usd ratio|credits-per-dollar|credits per dollar/i);

console.log('credits.selfcheck: ok');
