/**
 * Razorpay subscription.resumed / subscription.completed → users/{uid}.planStatus.
 * Run: npx tsx src/lib/billing/planStatusForSubscriptionEvent.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { planStatusForSubscriptionEvent } from './userSoT.ts';

assert.equal(planStatusForSubscriptionEvent('resumed'), 'active');
assert.equal(planStatusForSubscriptionEvent('completed'), 'completed');
assert.equal(planStatusForSubscriptionEvent('cancelled'), 'cancelled');
assert.equal(planStatusForSubscriptionEvent('paused'), 'paused');
assert.equal(planStatusForSubscriptionEvent('charged'), null);

const webhook = readFileSync(
  path.join(import.meta.dirname, '../../app/api/razorpay/webhook/route.ts'),
  'utf8'
);
assert.match(webhook, /case 'subscription\.resumed'/);
assert.match(webhook, /pointerDecision\(userId, subscription\.id, 'resumed'/);
assert.match(webhook, /planStatusForSubscriptionEvent\('resumed'\)/);
assert.match(webhook, /case 'subscription\.completed'/);
assert.match(webhook, /pointerDecision\(userId, subscription\.id, 'completed'/);
assert.match(webhook, /planStatusForSubscriptionEvent\('completed'\)/);

console.log('planStatusForSubscriptionEvent.selfcheck: ok');