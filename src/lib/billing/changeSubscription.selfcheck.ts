/**
 * Plan-change client: token auth via authedFetch, new-subscription flow only, no client uid.
 * Run: npx tsx src/lib/billing/changeSubscription.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const text = readFileSync(path.join(import.meta.dirname, 'changeSubscription.ts'), 'utf8');
assert.match(text, /authedFetch/);
assert.match(text, /\/api\/razorpay\/upgrade-upi/);
assert.match(text, /contentType\.includes\('application\/json'\)/);
assert.doesNotMatch(text, /\/api\/razorpay\/update-subscription/);
assert.doesNotMatch(text, /upi_upgrade_required/);
assert.doesNotMatch(text, /userId/);
assert.doesNotMatch(text, /start_at/);

console.log('changeSubscription.selfcheck: ok');
