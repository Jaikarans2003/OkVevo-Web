/**
 * Spend-guard ordering selfcheck. The unmetered-endpoint 400 in handleSubmit
 * must precede reserveCredits (no reserve row, no debit for an endpoint the
 * gateway cannot meter), and the read-only quote route must never reserve or
 * debit. No test harness here can exercise the handlers end-to-end (firebase
 * auth + firestore), so this pins the source ordering that carries the
 * invariant. Run: npx tsx src/lib/fal/spendGuard.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const queueSrc = readFileSync(path.join(import.meta.dirname, 'handleQueue.ts'), 'utf8');

// handleSubmit body: the meterable 400 return must come before reserveCredits.
const submitStart = queueSrc.indexOf('async function handleSubmit');
const submitEnd = queueSrc.indexOf('async function handleStatus');
assert.ok(submitStart >= 0 && submitEnd > submitStart, 'handleSubmit not found');
const submitBody = queueSrc.slice(submitStart, submitEnd);

const meterableIdx = submitBody.indexOf('!isMeterableEndpoint(endpoint)');
const reserveIdx = submitBody.indexOf('reserveCredits(');
assert.ok(meterableIdx >= 0, 'handleSubmit lost its meterable-endpoint guard');
assert.ok(reserveIdx >= 0, 'handleSubmit no longer reserves — selfcheck is stale');
assert.ok(
  meterableIdx < reserveIdx,
  'unmetered-endpoint 400 must precede reserveCredits — ' +
    'a reserve created before the meter check would debit an unmetered endpoint'
);

// The quote route is read-only: no reserve/debit/reconcile imports at all.
const quoteSrc = readFileSync(
  path.join(import.meta.dirname, '..', '..', 'app', 'api', 'fal', 'quote', 'route.ts'),
  'utf8'
);
for (const forbidden of ['reserveCredits', 'reconcileCredits', 'releaseCredits', 'patchGatewayJob']) {
  assert.ok(
    !quoteSrc.includes(forbidden),
    `quote route must stay read-only — found ${forbidden}`
  );
}
assert.ok(quoteSrc.includes('creditsFromUsd'), 'quote route must use the billing formula');
assert.ok(quoteSrc.includes('meterRawUsd'), 'quote route must meter like submit');

console.log('spendGuard.selfcheck: ok');
