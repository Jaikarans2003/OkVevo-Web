/**
 * Billing v2 Phase 6 verify: upgrade delta grant, floored %, no tax,
 * currency decided before checkout, cancel banner + spend-after-period-end.
 * Run: npx tsx src/lib/billing/phase6.verify.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  allocationCreditDelta,
  proratedCreditGrant,
  scheduleChangeAt,
} from './planChange.ts';
import {
  additionalRemainingPct,
  flooredPct,
  formatPctLabel,
  nextAllocationGrantedTotal,
  remainingPct,
} from '../../types/credits.ts';
import {
  getRazorpayPlanId,
  lookupPlanById,
  SUBSCRIPTION_PLANS,
} from '../../config/razorpay.ts';

const srcRoot = path.join(import.meta.dirname, '../..');

function src(rel: string): string {
  return readFileSync(path.join(srcRoot, rel), 'utf8');
}

// --- delta grant (Starter 20k → Pro 60k = +40k; downgrade never claws back) ---
assert.equal(SUBSCRIPTION_PLANS.starter.creditsIncluded, 20_000);
assert.equal(SUBSCRIPTION_PLANS.pro.creditsIncluded, 60_000);
assert.equal(allocationCreditDelta(20_000, 60_000), 40_000);
assert.equal(allocationCreditDelta(60_000, 20_000), 0);
assert.equal(scheduleChangeAt('starter', 'monthly', 'pro', 'monthly'), 'now');
assert.equal(scheduleChangeAt('pro', 'monthly', 'starter', 'monthly'), 'cycle_end');

assert.equal(proratedCreditGrant(40_000, 1, 2), 20_000);

const leftoverOnStarter = 19_931;
const afterUpgradeAdd = leftoverOnStarter + allocationCreditDelta(20_000, 60_000);
assert.equal(afterUpgradeAdd, 59_931);
assert.equal(flooredPct(afterUpgradeAdd, 60_000), 99.88);

const leftoverHalf = 10_000;
const cardGrant = proratedCreditGrant(40_000, 1, 2);
assert.equal(cardGrant, 20_000);
assert.notEqual(cardGrant, 60_000);
const cardBal = leftoverHalf + cardGrant;
const cardTank = nextAllocationGrantedTotal('add', 20_000, cardGrant, cardBal);
assert.equal(cardTank, 40_000);
assert.equal(cardBal, 30_000);
assert.equal(remainingPct(60_000, cardBal, cardTank), 75);
assert.notEqual(remainingPct(60_000, cardBal, cardTank), 87.5);

const upiGrant = 60_000;
const upiBal = leftoverHalf + upiGrant;
const upiTank = nextAllocationGrantedTotal('add', 20_000, upiGrant, upiBal);
assert.equal(upiTank, 80_000);
assert.equal(upiBal, 70_000);
assert.equal(remainingPct(60_000, upiBal, upiTank), 87.5);

assert.equal(nextAllocationGrantedTotal('set', 80_000, 20_000, 20_000), 20_000);
assert.equal(remainingPct(20_000, 20_000, 20_000), 100);

const webhook = src('app/api/razorpay/webhook/route.ts');
assert.match(webhook, /case 'subscription\.updated'/);
assert.match(webhook, /proratedCreditGrant\(/);
assert.match(webhook, /mode: 'add'/);
assert.match(
  webhook,
  /creditsIncludedForCharge\(\s*planMeta\?\.creditsIncluded,\s*userData\.creditsIncluded/
);

const debit = src('lib/gateway/debit.ts');
assert.match(debit, /mode === 'add' \? current\.allocationBalance \+ amount : amount/);
assert.match(debit, /Spend gate: planStatus must be 'active'/);
assert.match(debit, /readPlanStatus\(data\) !== 'active'/);

// --- % floor (19931/20000 is 99.65, never 100) ---
assert.equal(flooredPct(19_931, 20_000), 99.65);
assert.equal(Math.round((19_931 / 20_000) * 100), 100);
assert.equal(remainingPct(20_000, 19_931), 99.65);
assert.equal(additionalRemainingPct(2_500, 5_000), 50);
assert.equal(flooredPct(1, 20_000), 0);
assert.equal(remainingPct(60_000, 59_999, 60_000), 99.99);
assert.equal(formatPctLabel(87.5), '87.5%');
assert.equal(formatPctLabel(50), '50%');

const billingPage = src('app/billing/[[...slug]]/page.tsx');
assert.match(billingPage, /Plan remaining/);
assert.match(billingPage, /Additional remaining/);
assert.match(billingPage, /formatPctLabel\(clamped\)/);
assert.doesNotMatch(billingPage, /Number\.isInteger\(pct\)/);
assert.doesNotMatch(billingPage, /allocationBalance\.toLocaleString/);
assert.doesNotMatch(billingPage, /topUpBalance\.toLocaleString/);
assert.doesNotMatch(billingPage, /Math\.round\(\(billing\?\.remainingPct/);

const creditsService = src('services/CreditsService.ts');
assert.match(
  creditsService,
  /remainingPct: remainingPct\(creditsIncluded, allocationBalance, allocationGrantedTotal\)/
);
assert.match(creditsService, /additionalPct: additionalRemainingPct\(topUpBalance, topUpPurchasedTotal\)/);
assert.match(creditsService, /onSnapshot/);

// --- zero tax on checkout + billing surfaces ---
const taxSurfaces = [
  'app/billing/[[...slug]]/page.tsx',
  'components/landing-page/Pricing.tsx',
  'components/shared/payment/RazorpayCheckout.tsx',
  'components/billing/ChangePlanModal.tsx',
  'app/api/razorpay/create-subscription/route.ts',
  'app/api/razorpay/create-payment-link/route.ts',
  'app/api/razorpay/update-subscription/route.ts',
  'app/pricing/page.tsx',
] as const;
for (const rel of taxSurfaces) {
  assert.doesNotMatch(src(rel), /\bGST\b|\btax\b|\bTax\b/, `no tax line in ${rel}`);
}

// --- currency decided on pricing, before Razorpay Checkout ---
const pricing = src('components/landing-page/Pricing.tsx');
assert.match(pricing, /fetch\('\/api\/geo\/detect'\)/);
assert.match(pricing, /aria-label="Checkout currency"/);
assert.match(pricing, /currency=\{currency\}/);
assert.match(pricing, /selectCurrency/);

const landing = src('components/landing-page/LandingPage.tsx');
assert.match(landing, /<Pricing user=\{user\} \/>/);
assert.match(src('app/pricing/page.tsx'), /from '@\/components\/landing-page\/Pricing'/);

const checkout = src('components/shared/payment/RazorpayCheckout.tsx');
assert.match(checkout, /currency,/);
assert.doesNotMatch(checkout, /\/api\/geo\/detect/);
assert.doesNotMatch(checkout, /detectCountry/);
assert.doesNotMatch(checkout, /prefill:[\s\S]*address/);

const createSub = src('app/api/razorpay/create-subscription/route.ts');
assert.match(createSub, /isBillingCurrency\(currencyRaw\)/);
assert.match(createSub, /Must be "INR" or "USD"/);
assert.match(createSub, /getRazorpayPlanId\(/);

assert.equal(getRazorpayPlanId('starter', 'monthly', 'INR'), 'plan_TapXDOpk6VF1qo');
assert.equal(lookupPlanById('plan_TapXDOpk6VF1qo')?.currency, 'INR');
assert.equal(lookupPlanById(getRazorpayPlanId('starter', 'monthly', 'USD'))?.currency, 'USD');

// --- cancel: banner now; spend blocked only after Razorpay fires cancelled ---
assert.match(billingPage, /Cancellation scheduled/);
assert.match(billingPage, /Won&apos;t renew/);
const cancelRoute = src('app/api/razorpay/cancel-subscription/route.ts');
assert.match(cancelRoute, /cancelAtPeriodEnd: true/);
assert.doesNotMatch(cancelRoute, /planStatus: 'cancelled'/);
assert.match(webhook, /case 'subscription\.cancelled'/);
assert.match(webhook, /planStatus: 'cancelled'/);

console.log('phase6.verify.selfcheck: ok');
