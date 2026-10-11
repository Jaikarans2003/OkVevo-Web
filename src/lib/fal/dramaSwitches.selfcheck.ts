/**
 * Guardrail truth tables: kill switch, circuit breaker (80% warn / 100% stop),
 * env limit parsing. Run: npx tsx src/lib/fal/dramaSwitches.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  applySpendClose,
  breakerDecision,
  BREAKER_WARN_RATIO,
  dailySpendLimitFromEnv,
  DEFAULT_DAILY_SPEND_LIMIT_USD,
  killSwitchDisabled,
  settleSpendOnce,
} from '@/lib/fal/dramaSwitches';

assert.equal(killSwitchDisabled(undefined), false);
assert.equal(killSwitchDisabled({}), false);
assert.equal(killSwitchDisabled({ disabled: false }), false);
assert.equal(killSwitchDisabled({ disabled: 'yes' }), false);
assert.equal(killSwitchDisabled({ disabled: true }), true);

const limit = 100;
assert.equal(breakerDecision(0, limit), 'ok');
assert.equal(breakerDecision(limit * BREAKER_WARN_RATIO - 0.01, limit), 'ok');
assert.equal(breakerDecision(limit * BREAKER_WARN_RATIO, limit), 'warn');
assert.equal(breakerDecision(limit - 0.01, limit), 'warn');
assert.equal(breakerDecision(limit, limit), 'stop');
assert.equal(breakerDecision(limit * 2, limit), 'stop');
assert.equal(breakerDecision(500, 0), 'stop'); // explicit 0 is a hard stop
assert.equal(breakerDecision(-1, limit), 'ok');
assert.equal(dailySpendLimitFromEnv({ DRAMA_DAILY_SPEND_LIMIT_USD: '0' } as NodeJS.ProcessEnv), 0);

assert.equal(dailySpendLimitFromEnv({} as NodeJS.ProcessEnv), DEFAULT_DAILY_SPEND_LIMIT_USD);
assert.equal(
  dailySpendLimitFromEnv({ DRAMA_DAILY_SPEND_LIMIT_USD: '75' } as NodeJS.ProcessEnv),
  75
);
assert.equal(
  dailySpendLimitFromEnv({ DRAMA_DAILY_SPEND_LIMIT_USD: '-5' } as NodeJS.ProcessEnv),
  DEFAULT_DAILY_SPEND_LIMIT_USD
);
assert.equal(
  dailySpendLimitFromEnv({ DRAMA_DAILY_SPEND_LIMIT_USD: 'abc' } as NodeJS.ProcessEnv),
  DEFAULT_DAILY_SPEND_LIMIT_USD
);

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
