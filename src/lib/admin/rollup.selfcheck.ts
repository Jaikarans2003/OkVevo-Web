/**
 * Rollup aggregation vectors. Run: npx tsx src/lib/admin/rollup.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { buildRollup, type RollupJobRow } from '@/lib/admin/rollup';

const day = '2026-10-10';
const t0 = Date.parse('2026-10-10T00:00:00Z');

const jobs: RollupJobRow[] = [
  {
    uid: 'u1',
    endpoint: 'minimax/music-3',
    status: 'settled',
    createdAtMs: t0 + 1000,
    settledAtMs: t0 + 61_000,
    settledCredits: 240,
    settledFalUsd: 0.12,
  },
  {
    uid: 'u1',
    endpoint: 'bytedance/seedance-2.5/reference-to-video',
    status: 'settled',
    createdAtMs: t0 + 2000,
    settledAtMs: t0 + 302_000,
    settledCredits: 9984,
    settledFalUsd: 4.992,
  },
  {
    uid: 'u2',
    endpoint: 'minimax/music-3',
    status: 'released',
    createdAtMs: t0 + 3000,
  },
  // not finished today — excluded from counts
  { uid: 'u3', endpoint: 'minimax/music-3', status: 'submitted', createdAtMs: t0 + 4000 },
];

const rollup = buildRollup({
  day,
  jobsToday: jobs,
  holds: { unknown: 1, reservedOld: 2, submittedOld: 3 },
  spendDaily: { falUsd: 5.112, creditsCharged: 10224, jobs: 2, overReserveEvents: 1 },
  breakerLimitUsd: 250,
});

assert.equal(rollup.day, day);
assert.equal(rollup.jobs.settled, 2);
assert.equal(rollup.jobs.released, 1);
assert.ok(Math.abs((rollup.jobs.successRate ?? 0) - 2 / 3) < 1e-9);
assert.equal(rollup.jobs.avgSettleMs, Math.round((60_000 + 300_000) / 2));
assert.equal(rollup.jobs.byEndpoint['minimax/music-3'].settled, 1);
assert.equal(rollup.jobs.byEndpoint['minimax/music-3'].released, 1);

assert.equal(rollup.spend.falUsd, 5.112);
assert.equal(rollup.spend.creditsCharged, 10224);
assert.equal(rollup.spend.overReserveEvents, 1);
assert.equal(rollup.spend.byEndpoint['bytedance/seedance-2.5/reference-to-video'].falUsd, 4.992);
// margin estimate = 1 − falUsd / (credits/1000)
assert.ok(rollup.spend.marginEstimate != null && rollup.spend.marginEstimate > 0.4);
assert.equal(rollup.spend.marginRealized, null);
assert.deepEqual(rollup.spend.billedVsLedger, {});

assert.deepEqual(rollup.holds, { unknown: 1, reservedOld: 2, submittedOld: 3 });
assert.equal(rollup.breaker.decision, 'ok');
assert.equal(rollup.topUsers[0].uid, 'u1');
assert.equal(rollup.topUsers[0].creditsCharged, 240 + 9984);
assert.equal(rollup.topUsers.length, 1);

// Empty day is well-formed.
const empty = buildRollup({
  day,
  jobsToday: [],
  holds: { unknown: 0, reservedOld: 0, submittedOld: 0 },
  spendDaily: { falUsd: 0, creditsCharged: 0, jobs: 0 },
  breakerLimitUsd: 250,
});
assert.equal(empty.jobs.successRate, null);
assert.equal(empty.jobs.avgSettleMs, null);
assert.equal(empty.spend.marginEstimate, null);
assert.deepEqual(empty.topUsers, []);

// Breaker reflector.
const tripped = buildRollup({
  day,
  jobsToday: [],
  holds: { unknown: 0, reservedOld: 0, submittedOld: 0 },
  spendDaily: { falUsd: 250, creditsCharged: 0, jobs: 0 },
  breakerLimitUsd: 250,
});
assert.equal(tripped.breaker.decision, 'stop');

console.log('rollup.selfcheck: ok');
