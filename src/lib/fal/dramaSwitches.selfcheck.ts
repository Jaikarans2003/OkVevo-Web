/**
 * Daily spend close: held never goes negative; a second close is a no-op.
 * Run: npx tsx src/lib/fal/dramaSwitches.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { applySpendClose, settleSpendOnce } from '@/lib/fal/dramaSwitches';

const firstClose = applySpendClose(
  { falUsd: 10, falUsdHeld: 2, creditsCharged: 100, jobs: 1 },
  { reservedFalUsd: 2, settledRawUsd: 1.5, actualCredits: 40 }
);
assert.equal(firstClose.falUsd, 11.5);
assert.equal(firstClose.falUsdHeld, 0);
assert.equal(firstClose.creditsCharged, 140);
assert.equal(firstClose.jobs, 2);
const overRelease = applySpendClose(
  { falUsdHeld: 1 },
  { reservedFalUsd: 5, settledRawUsd: 0, actualCredits: 0 }
);
assert.equal(overRelease.falUsdHeld, 0);

const settledIds = new Set<string>();
const jobId = 'fal-job-1';
const start = { falUsd: 0, falUsdHeld: 3, creditsCharged: 0, jobs: 0 };
const webhook = settleSpendOnce(settledIds, jobId, start, {
  reservedFalUsd: 3,
  settledRawUsd: 2,
  actualCredits: 50,
});
assert.equal(webhook.skipped, false);
const poll = settleSpendOnce(settledIds, jobId, webhook.spend, {
  reservedFalUsd: 3,
  settledRawUsd: 2,
  actualCredits: 50,
});
assert.equal(poll.skipped, true);
assert.deepEqual(poll.spend, webhook.spend);
assert.equal(poll.spend.jobs, 1);
assert.ok(poll.spend.falUsdHeld >= 0);

console.log('dramaSwitches.selfcheck: ok');
