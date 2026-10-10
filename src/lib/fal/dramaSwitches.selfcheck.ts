/**
 * Guardrail truth tables: kill switch, circuit breaker (80% warn / 100% stop),
 * env limit parsing. Run: npx tsx src/lib/fal/dramaSwitches.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  breakerDecision,
  BREAKER_WARN_RATIO,
  dailySpendLimitFromEnv,
  DEFAULT_DAILY_SPEND_LIMIT_USD,
  killSwitchDisabled,
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
assert.equal(breakerDecision(500, 0), 'ok'); // misconfigured limit never blocks
assert.equal(breakerDecision(-1, limit), 'ok');

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

console.log('dramaSwitches.selfcheck: ok');
