/**
 * Gateway HTTP errors the desktop credential pool actually classifies.
 * Run: npx tsx src/lib/gateway/httpErrors.selfcheck.ts
 *
 * reset_at is epoch seconds: credential_pool_timestamps._parse_absolute_timestamp
 * treats a number <= 1e12 as epoch seconds. Retry-After is delta-seconds
 * (agent/retry_utils.parse_retry_after_seconds).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  BEARER_INVALID_TOKEN,
  GATEWAY_RETRY_AFTER_SECONDS,
  inFlightBudgetResponse,
  insufficientCreditsResponse,
  invalidTokenResponse,
  planConcurrencyResponse,
} from './httpErrors.ts';
import { chatConcurrencyBlocked, denialForFailedReserve, summarizeOpenHolds } from './reserveDenial.ts';

const nowMs = 1_700_000_000_000;
const resetAt = Math.floor(nowMs / 1000) + GATEWAY_RETRY_AFTER_SECONDS;

const missing = invalidTokenResponse();
assert.equal(missing.status, 401);
assert.equal(missing.headers.get('www-authenticate'), BEARER_INVALID_TOKEN);
const missingBody = await missing.json();
assert.equal(missingBody.error.code, 'invalid_api_key');
assert.equal(missingBody.error.reset_at, undefined);
assert.notEqual(missingBody.error.code, 'invalid_token');

const broke = insufficientCreditsResponse();
assert.equal(broke.status, 402);
assert.equal(broke.headers.get('retry-after'), null);
assert.equal(broke.headers.get('www-authenticate'), null);
const brokeBody = await broke.json();
assert.equal(brokeBody.error.code, 'insufficient_quota');
assert.equal(brokeBody.error.message, 'insufficient credits');
assert.equal(brokeBody.error.reset_at, undefined);

for (const [res, code] of [
  [inFlightBudgetResponse(nowMs), 'in_flight_budget_exhausted'],
  [planConcurrencyResponse(nowMs), 'plan_concurrency_limit'],
] as const) {
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), String(GATEWAY_RETRY_AFTER_SECONDS));
  assert.equal(res.headers.get('www-authenticate'), null);
  const body = await res.json();
  assert.equal(body.error.code, code);
  assert.equal(body.error.type, 'rate_limit_error');
  assert.equal(body.error.reset_at, resetAt);
  assert.ok(body.error.reset_at < 1_000_000_000_000);
  assert.doesNotMatch(body.error.message, /insufficient|quota|openrouter/i);
}

assert.equal(denialForFailedReserve({ spendable: 10, estimated: 50, inFlightHeld: 0 }), 'insufficient');
assert.equal(
  denialForFailedReserve({ spendable: 10, estimated: 50, inFlightHeld: 40 }),
  'in_flight_budget_exhausted'
);
assert.equal(
  denialForFailedReserve({ spendable: 10, estimated: 50, inFlightHeld: 5 }),
  'insufficient'
);
assert.equal(chatConcurrencyBlocked(2, 2), true);
assert.equal(chatConcurrencyBlocked(1, 2), false);
assert.equal(chatConcurrencyBlocked(0, 0), false);

assert.deepEqual(
  summarizeOpenHolds([
    { provider: 'openrouter', status: 'reserved', heldAllocation: 3, heldTopUp: 1 },
    { provider: 'fal', status: 'queued', estimatedCredits: 9 },
    { provider: 'openrouter', status: 'settled', heldAllocation: 100, heldTopUp: 0 },
  ]),
  { held: 13, openChat: 1 }
);

const srcRoot = path.join(import.meta.dirname, '../..');
function src(rel: string): string {
  return readFileSync(path.join(srcRoot, rel), 'utf8');
}

const chat = src('app/api/gateway/chat/completions/route.ts');
const models = src('app/api/gateway/models/route.ts');
assert.match(chat, /invalidTokenResponse\(\)/);
assert.match(models, /invalidTokenResponse\(\)/);
assert.doesNotMatch(chat, /status:\s*401/);
assert.doesNotMatch(models, /status:\s*401/);
assert.doesNotMatch(models, /402/);
assert.equal(chat.match(/invalidTokenResponse\(\)/g)?.length, 2);
assert.equal(models.match(/invalidTokenResponse\(\)/g)?.length, 2);

console.log('httpErrors.selfcheck: ok');
