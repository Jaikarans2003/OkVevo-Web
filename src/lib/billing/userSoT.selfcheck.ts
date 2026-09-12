/**
 * Current-pointer guard + paymentMethod SoT. No Firebase.
 * Run: npx tsx src/lib/billing/userSoT.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { topUpAmountMinorUnits } from './currency.ts';
import { proratedCreditGrant } from './planChange.ts';
import {
  isUpiLikePaymentMethod,
  isUpiSubscriptionUpdateError,
  normalizePaymentMethod,
  razorpayErrorDescription,
  shouldApplySubscriptionEvent,
  userBillingFromData,
} from './userSoT.ts';

assert.equal(normalizePaymentMethod('upi'), 'upi');
assert.equal(normalizePaymentMethod('creditcard'), 'card');
assert.equal(normalizePaymentMethod('payment_method'), null);
assert.equal(isUpiLikePaymentMethod('upi'), true);
assert.equal(isUpiLikePaymentMethod('card'), false);
assert.equal(
  isUpiSubscriptionUpdateError({
    error: { description: 'subscriptions cannot be updated when payment mode is UPI' },
  }),
  true
);
assert.equal(razorpayErrorDescription({ error: { description: 'limit reached' } }), 'limit reached');

assert.equal(topUpAmountMinorUnits(10, 'INR'), 100_000);
assert.equal(topUpAmountMinorUnits(10, 'USD'), 1_000);
assert.equal(proratedCreditGrant(40_000, 1, 2), 20_000);
assert.equal(proratedCreditGrant(40_000, 0, 2), 0);
assert.equal(proratedCreditGrant(0, 1, 2), 0);

const empty = userBillingFromData('u1', undefined);
assert.equal(empty.paymentMethod, null);
assert.equal(empty.razorpaySubscriptionId, null);

const fromUser = userBillingFromData('u1', {
  paymentMethod: 'upi',
  payment_method: 'card',
  razorpaySubscriptionId: 'sub_max',
  planStatus: 'active',
});
assert.equal(fromUser.paymentMethod, 'upi');
assert.equal(fromUser.razorpaySubscriptionId, 'sub_max');

type Slice = {
  razorpaySubscriptionId: string | null;
  planStatus: string | null;
  plan: string | null;
  allocationBalance: number;
  creditsIncluded: number;
};

function apply(
  user: Slice,
  ev: {
    event: 'activated' | 'cancelled';
    eventSubId: string;
    notes?: { upgrade_flow?: string; replacing_subscription_id?: string };
    plan?: string;
    creditsIncluded?: number;
  }
): Slice {
  const decision = shouldApplySubscriptionEvent({
    eventSubId: ev.eventSubId,
    currentSubId: user.razorpaySubscriptionId,
    event: ev.event,
    notes: ev.notes,
    currentPlanStatus: user.planStatus,
  });
  if (!decision.apply) return { ...user };
  if (ev.event === 'cancelled') {
    return { ...user, planStatus: 'cancelled' };
  }
  const credits = ev.creditsIncluded ?? user.creditsIncluded;
  return {
    ...user,
    razorpaySubscriptionId: ev.eventSubId,
    planStatus: 'active',
    plan: ev.plan ?? user.plan,
    creditsIncluded: credits,
    allocationBalance:
      decision.reason === 'replacement' ? user.allocationBalance + credits : credits,
  };
}

let user: Slice = {
  razorpaySubscriptionId: null,
  planStatus: null,
  plan: null,
  allocationBalance: 0,
  creditsIncluded: 0,
};
user = apply(user, {
  event: 'activated',
  eventSubId: 'sub_starter',
  notes: {},
  plan: 'starter',
  creditsIncluded: 20_000,
});
assert.equal(user.razorpaySubscriptionId, 'sub_starter');
assert.equal(user.allocationBalance, 20_000);

user = apply(user, {
  event: 'activated',
  eventSubId: 'sub_pro',
  notes: { upgrade_flow: 'true', replacing_subscription_id: 'sub_starter' },
  plan: 'pro',
  creditsIncluded: 60_000,
});
assert.equal(user.razorpaySubscriptionId, 'sub_pro');
assert.equal(user.plan, 'pro');
assert.equal(user.allocationBalance, 80_000);

user = apply(user, {
  event: 'activated',
  eventSubId: 'sub_max',
  notes: { upgrade_flow: 'true', replacing_subscription_id: 'sub_pro' },
  plan: 'max',
  creditsIncluded: 100_000,
});
assert.equal(user.razorpaySubscriptionId, 'sub_max');
assert.equal(user.planStatus, 'active');
assert.equal(user.plan, 'max');
assert.equal(user.allocationBalance, 180_000);

const afterMax = { ...user };
user = apply(user, { event: 'cancelled', eventSubId: 'sub_starter', notes: {} });
assert.equal(user.planStatus, 'active');
assert.equal(user.plan, 'max');
assert.equal(user.allocationBalance, afterMax.allocationBalance);
assert.equal(user.razorpaySubscriptionId, 'sub_max');

user = apply(user, { event: 'cancelled', eventSubId: 'sub_max', notes: {} });
assert.equal(user.planStatus, 'cancelled');

assert.equal(
  shouldApplySubscriptionEvent({
    eventSubId: 'sub_new',
    currentSubId: 'sub_max',
    event: 'activated',
    notes: { upgrade_flow: 'true', replacing_subscription_id: 'sub_max' },
    currentPlanStatus: 'active',
  }).apply,
  true
);
assert.equal(
  shouldApplySubscriptionEvent({
    eventSubId: 'sub_new',
    currentSubId: 'sub_max',
    event: 'activated',
    notes: { upgrade_flow: 'true', replacing_subscription_id: 'sub_stale' },
    currentPlanStatus: 'active',
  }).reason,
  'stale'
);

const root = path.join(import.meta.dirname, '../..');
const webhook = readFileSync(path.join(root, 'app/api/razorpay/webhook/route.ts'), 'utf8');
assert.match(webhook, /shouldApplySubscriptionEvent/);
assert.match(webhook, /logStaleSubscriptionEvent/);
assert.match(webhook, /proratedCreditGrant\(/);
assert.match(webhook, /mode: addFullGrant \? 'add' : 'set'/);
assert.match(webhook, /paymentMethod: instrument/);
assert.doesNotMatch(webhook, /paymentMethod: payment_method/);

const userSoT = readFileSync(path.join(root, 'lib/billing/userSoT.ts'), 'utf8');
assert.match(userSoT, /normalizePaymentMethod\(data\.paymentMethod\)/);
assert.match(userSoT, /stale subscription event/);
assert.doesNotMatch(userSoT, /data\.payment_method/);

console.log('userSoT.selfcheck: ok');
