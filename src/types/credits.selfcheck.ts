/**
 * Credit types: two-bucket SoT + opaque integer platform credit unit.
 * Run: npx tsx src/types/credits.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  availableCredits,
  remainingPct,
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

assert.equal(remainingPct(20000, 10000), 0.5);
assert.equal(remainingPct(0, 100), 0);
assert.equal(availableCredits(100, 50), 150);

assert.match(src, /platform credit unit, integer/);
assert.match(src, /allocationBalance/);
assert.match(src, /topUpBalance/);
assert.doesNotMatch(src, /FEATURE_COSTS|FeatureType/);
assert.doesNotMatch(src, /micros/i);
assert.doesNotMatch(src, /1_000_000/);
assert.doesNotMatch(src, /\$1\s*=/);
assert.doesNotMatch(src, /USD ratio|usd ratio|credits-per-dollar|credits per dollar/i);

console.log('credits.selfcheck: ok');
