/**
 * Dual-currency price book: 12 plan_ids, same credits both books, frozen INR table.
 * Run: npx tsx src/config/razorpay.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  BILLING_CURRENCIES,
  RAZORPAY_PLAN_IDS,
  SUBSCRIPTION_PLANS,
  formatPlanPrice,
  getPlanDetailsByPeriod,
  getRazorpayPlanId,
  lookupPlanById,
  type BillingPeriod,
  type SelfServePlanType,
} from './razorpay.ts';

const tiers: SelfServePlanType[] = ['starter', 'pro', 'max'];
const periods: BillingPeriod[] = ['monthly', 'annual'];
const ids: string[] = [];

for (const tier of tiers) {
  for (const period of periods) {
    for (const currency of BILLING_CURRENCIES) {
      const id = getRazorpayPlanId(tier, period, currency);
      assert.ok(id.startsWith('plan_'), `${tier} ${period} ${currency} plan id`);
      ids.push(id);
      const meta = lookupPlanById(id);
      assert.ok(meta, `lookup ${id}`);
      assert.equal(meta!.name, tier);
      assert.equal(meta!.currency, currency);
      assert.equal(meta!.billingCycle, period === 'annual' ? 'yearly' : 'monthly');
      assert.equal(meta!.creditsIncluded, SUBSCRIPTION_PLANS[tier].creditsIncluded);
    }
  }
}

assert.equal(ids.length, 12);
assert.equal(new Set(ids).size, 12, '12 unique plan ids');

assert.equal(
  lookupPlanById(RAZORPAY_PLAN_IDS.starter.monthly.USD)?.creditsIncluded,
  lookupPlanById(RAZORPAY_PLAN_IDS.starter.monthly.INR)?.creditsIncluded
);

const inrStarterMo = getPlanDetailsByPeriod('starter', 'monthly', 'INR');
assert.equal(inrStarterMo.price, 1999);
assert.equal(inrStarterMo.currency, 'INR');
const inrStarterYr = getPlanDetailsByPeriod('starter', 'annual', 'INR');
assert.equal(inrStarterYr.price, 20388);
assert.equal(inrStarterYr.displayedMonthly, 1699);
assert.equal(inrStarterYr.displayedMonthly, inrStarterYr.price / 12);

assert.equal(getPlanDetailsByPeriod('pro', 'monthly', 'INR').price, 5999);
assert.equal(getPlanDetailsByPeriod('pro', 'annual', 'INR').price, 61188);
assert.equal(getPlanDetailsByPeriod('pro', 'annual', 'INR').displayedMonthly, 5099);
assert.equal(getPlanDetailsByPeriod('max', 'monthly', 'INR').price, 9999);
assert.equal(getPlanDetailsByPeriod('max', 'annual', 'INR').price, 101988);
assert.equal(getPlanDetailsByPeriod('max', 'annual', 'INR').displayedMonthly, 8499);

const usdStarter = getPlanDetailsByPeriod('starter', 'monthly', 'USD');
assert.equal(usdStarter.price, 20);
assert.equal(usdStarter.currency, 'USD');
assert.equal(getPlanDetailsByPeriod('starter', 'annual', 'USD').price, 20 * 12 * 0.85);

assert.equal(formatPlanPrice(20, 'USD'), '$20');
assert.match(formatPlanPrice(1999, 'INR'), /1,999/);

assert.equal(RAZORPAY_PLAN_IDS.starter.monthly.INR, 'plan_TapXDOpk6VF1qo');
assert.equal(RAZORPAY_PLAN_IDS.starter.annual.INR, 'plan_TapYqxTWzFYaxl');
assert.equal(RAZORPAY_PLAN_IDS.pro.monthly.INR, 'plan_TapZn30VKBc68V');
assert.equal(RAZORPAY_PLAN_IDS.pro.annual.INR, 'plan_Tapas8COpIuqsJ');
assert.equal(RAZORPAY_PLAN_IDS.max.monthly.INR, 'plan_TapbeJ6GchzbX5');
assert.equal(RAZORPAY_PLAN_IDS.max.annual.INR, 'plan_TapckEOs5LT87W');

const root = path.join(import.meta.dirname, '..');
const createSub = readFileSync(path.join(root, 'app/api/razorpay/create-subscription/route.ts'), 'utf8');
assert.match(createSub, /currency:/);
assert.doesNotMatch(createSub, /gst|GST|tax_invoice|taxAmount/i);

const checkout = readFileSync(
  path.join(root, 'components/shared/payment/RazorpayCheckout.tsx'),
  'utf8'
);
assert.match(checkout, /currency,/);
assert.doesNotMatch(checkout, /currency:\s*currency/);
assert.doesNotMatch(checkout, /gst|GST|tax_invoice/i);

const update = readFileSync(path.join(root, 'app/api/razorpay/update-subscription/route.ts'), 'utf8');
assert.match(update, /getRazorpayPlanId\([^)]+currency/);

console.log('razorpay.selfcheck: ok');
