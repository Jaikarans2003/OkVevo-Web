/**
 * Phase 2 plan-change: upgrade now / downgrade cycle_end, delta ADD, charged plan-meta order.
 * Run: npx tsx src/lib/billing/planChange.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  allocationCreditDelta,
  creditsIncludedForCharge,
  hasScheduledPlanChange,
  isLivePlanStatus,
  isSamePlan,
  nextUpgradeTier,
  planChangeCopy,
  portalBillingActionFromSlug,
  proratedCreditGrant,
  scheduleChangeAt,
  subscriptionUpdatedRequestId,
  toBillingPeriod,
} from './planChange.ts';

assert.equal(toBillingPeriod('yearly'), 'annual');
assert.equal(toBillingPeriod('annual'), 'annual');
assert.equal(toBillingPeriod('monthly'), 'monthly');
assert.equal(toBillingPeriod(null), 'monthly');

assert.equal(isSamePlan('starter', 'monthly', 'starter', 'monthly'), true);
assert.equal(isSamePlan('starter', 'yearly', 'starter', 'annual'), true);
assert.equal(isSamePlan('starter', 'monthly', 'starter', 'annual'), false);
assert.equal(isSamePlan('starter', 'monthly', 'pro', 'monthly'), false);

assert.equal(scheduleChangeAt('starter', 'monthly', 'pro', 'monthly'), 'now');
assert.equal(scheduleChangeAt('starter', 'monthly', 'max', 'annual'), 'now');
assert.equal(scheduleChangeAt('max', 'monthly', 'pro', 'monthly'), 'cycle_end');
assert.equal(scheduleChangeAt('pro', 'monthly', 'starter', 'annual'), 'cycle_end');
assert.equal(scheduleChangeAt('starter', 'monthly', 'starter', 'annual'), 'now');
assert.equal(scheduleChangeAt('pro', 'yearly', 'pro', 'monthly'), 'cycle_end');

assert.equal(nextUpgradeTier('starter'), 'pro');
assert.equal(nextUpgradeTier('pro'), 'max');
assert.equal(nextUpgradeTier('max'), null);
assert.equal(nextUpgradeTier(null), null);
assert.equal(portalBillingActionFromSlug(['change-plan']), 'change-plan');
assert.equal(portalBillingActionFromSlug(['cancel']), 'cancel');
assert.equal(portalBillingActionFromSlug(['upgrade']), 'upgrade');
assert.equal(portalBillingActionFromSlug(undefined), 'overview');
assert.equal(
  planChangeCopy('now'),
  'You will pay the prorated difference now. Your billing date stays the same.'
);
assert.equal(
  planChangeCopy('now', { upi: true }),
  'You will pay the full new-plan price via a new UPI payment. Existing credits stay until the new billing date.'
);

assert.equal(proratedCreditGrant(40_000, 1, 2), 20_000);
assert.equal(proratedCreditGrant(40_000, 15, 30), 20_000);
assert.equal(proratedCreditGrant(0, 1, 2), 0);
assert.equal(isLivePlanStatus('active'), true);
assert.equal(isLivePlanStatus('cancelled'), false);

assert.equal(allocationCreditDelta(20_000, 60_000), 40_000);
assert.equal(allocationCreditDelta(60_000, 20_000), 0);
assert.equal(allocationCreditDelta(20_000, 20_000), 0);
assert.equal(allocationCreditDelta(undefined, 60_000), 60_000);
assert.equal(allocationCreditDelta(-1, 60_000), 60_000);

assert.equal(creditsIncludedForCharge(20_000, 60_000), 20_000);
assert.equal(creditsIncludedForCharge(undefined, 60_000), 60_000);
assert.equal(creditsIncludedForCharge(undefined, undefined), undefined);

assert.equal(hasScheduledPlanChange(true), true);
assert.equal(hasScheduledPlanChange(1), true);
assert.equal(hasScheduledPlanChange(false), false);

assert.equal(
  subscriptionUpdatedRequestId('sub_abc', 1710000000),
  'sub_updated_sub_abc_1710000000'
);
assert.equal(
  subscriptionUpdatedRequestId('sub_abc', 'nope', 1710000001),
  'sub_updated_sub_abc_1710000001'
);
assert.equal(subscriptionUpdatedRequestId('sub_abc', 'nope'), 'sub_updated_sub_abc_0');

const root = path.join(import.meta.dirname, '../..');
const updateRoute = readFileSync(
  path.join(root, 'app/api/razorpay/update-subscription/route.ts'),
  'utf8'
);
assert.match(updateRoute, /scheduleChangeAt\(/);
assert.match(updateRoute, /schedule_change_at: when/);
assert.doesNotMatch(updateRoute, /start_at:/);
assert.doesNotMatch(updateRoute, /remaining_count:/);
assert.match(updateRoute, /upi_upgrade_required/);

const webhook = readFileSync(
  path.join(root, 'app/api/razorpay/webhook/route.ts'),
  'utf8'
);
assert.match(webhook, /case 'subscription\.updated'/);
assert.match(webhook, /creditsIncludedForCharge\(/);
assert.match(webhook, /mode: 'add'/);
assert.match(webhook, /proratedCreditGrant\(/);
assert.match(webhook, /allocationCreditDelta\(/);
assert.match(
  webhook,
  /creditsIncludedForCharge\(\s*planMeta\?\.creditsIncluded,\s*userData\.creditsIncluded/
);

const debit = readFileSync(path.join(root, 'lib/gateway/debit.ts'), 'utf8');
assert.match(debit, /opts\.mode \?\? 'set'/);
assert.match(debit, /mode === 'add'/);

console.log('planChange.selfcheck: ok');
