/**
 * Credit types: opaque integer platform credit unit. No USD ratio.
 * Run: npx tsx src/types/credits.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CreditTransaction, TransactionType, UserCredits } from './credits.ts';

const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'credits.ts'),
  'utf8'
);

const types: TransactionType[] = ['grant', 'debit', 'refund'];
assert.deepEqual(types, ['grant', 'debit', 'refund']);

function assertNonNegInt(n: number, label: string) {
  assert.equal(Number.isInteger(n) && n >= 0, true, label);
}

const balance: UserCredits['creditBalance'] = 0;
const amount: CreditTransaction['amount'] = 0;
assertNonNegInt(balance, 'creditBalance is a non-negative integer');
assertNonNegInt(amount, 'amount is a non-negative integer');

assert.match(src, /platform credit unit, integer/);
assert.doesNotMatch(src, /FEATURE_COSTS|FeatureType/);
assert.doesNotMatch(src, /micros/i);
assert.doesNotMatch(src, /1_000_000/);
assert.doesNotMatch(src, /\$1\s*=/);
assert.doesNotMatch(src, /USD ratio|usd ratio|credits-per-dollar|credits per dollar/i);

console.log('credits.selfcheck: ok');
