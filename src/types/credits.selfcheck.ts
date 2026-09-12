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
  nextTopUpPurchasedTotal,
  remainingPct,
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
assert.equal(remainingPct(0, 100), 0);
assert.equal(flooredPct(19931, 20000), 99);
assert.notEqual(Math.round((19931 / 20000) * 100), 99);
assert.equal(Math.round((19931 / 20000) * 100), 100);
assert.equal(flooredPct(1, 20000), 0);
assert.equal(flooredPct(20000, 20000), 100);
assert.equal(flooredPct(50, 0), 0);
assert.equal(additionalRemainingPct(2500, 5000), 50);
assert.equal(additionalRemainingPct(5000, 0), 100);
assert.equal(additionalRemainingPct(0, 0), 0);
assert.equal(nextTopUpPurchasedTotal(0, 500, 1500), 1500);
assert.equal(nextTopUpPurchasedTotal(1000, 500, 800), 1500);
assert.equal(seedTopUpPurchasedTotal(0, 5000, 3000), 5000);
assert.equal(seedTopUpPurchasedTotal(8000, 5000, 3000), 8000);
assert.equal(availableCredits(100, 50), 150);

const debit = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/gateway/debit.ts'),
  'utf8'
);
assert.match(debit, /topUpPurchasedTotal/);
assert.match(debit, /nextTopUpPurchasedTotal/);

const billingPage = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../app/billing/[[...slug]]/page.tsx'),
  'utf8'
);
assert.match(billingPage, /Plan remaining/);
assert.match(billingPage, /Additional remaining/);
assert.doesNotMatch(billingPage, /Math\.round\(\(billing\?\.remainingPct/);
assert.doesNotMatch(billingPage, /billing\?\.additional \?\? 0\)\.toLocaleString/);

assert.match(src, /platform credit unit, integer/);
assert.match(src, /allocationBalance/);
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
