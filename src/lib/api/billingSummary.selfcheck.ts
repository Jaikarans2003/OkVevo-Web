/**
 * Billing summary: percentages only; additional % uses top_up_reference; ended after periodEnd.
 * Run: npx tsx src/lib/api/billingSummary.selfcheck.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { billingDisplayStatus, billingSummaryFromAccount } from './billingSummary.ts'
import type { BillingAccountData } from '@/lib/db/wallet'

const base: BillingAccountData = {
  id: 'ba-1',
  ownerUserId: 'u1',
  ownerOrgId: null,
  accountKind: 'individual',
  accessMode: 'subscription',
  plan: 'starter',
  planName: 'Starter',
  planStatus: 'active',
  billingCycle: 'monthly',
  currency: 'USD',
  razorpayCustomerId: null,
  razorpaySubscriptionId: 'sub_1',
  paymentMethod: 'card',
  creditsIncluded: 20_000,
  allocationBalance: 15_000,
  topUpBalance: 500,
  topUpReference: 1_000,
  sponsoredBalance: 0,
  sponsoredReference: 0,
  allocationGrantedTotal: 20_000,
  topUpPurchasedTotal: 1_000,
  nextAllocationDate: null,
  currentPeriodEnd: new Date('2030-01-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
  hasScheduledChanges: false,
  scheduledPlanType: null,
  scheduledPlanId: null,
  scheduledChangeAt: null,
  concurrencyOverride: null,
}

const now = new Date('2026-06-01T00:00:00.000Z')
const summary = billingSummaryFromAccount(base, now)

assert.equal(summary.entitled, true)
assert.equal(summary.status, 'active')
assert.equal(summary.remainingPct, 75)
assert.equal(summary.additionalPct, 50)
assert.equal(summary.sponsoredPct, 0)
assert.equal(summary.overdrawnPct, 0)
assert.equal(summary.accountKind, 'individual')
assert.equal(summary.canPurchase, true)
assert.equal(summary.fundedBy, null)
assert.equal(summary.additionalNextExpiry, null)
assert.equal(
  billingSummaryFromAccount(
    { ...base, ownerUserId: null, ownerOrgId: 'o1', accountKind: 'org', accessMode: 'prepaid' },
    now
  ).canPurchase,
  false
)
assert.equal('allocationBalance' in summary, false)
assert.equal('topUpBalance' in summary, false)
assert.equal('additionalCredits' in summary, false)

// buy 1,000 → 100%; spend 700 → 30%; buy 1,000 → 100%; spend 650 → 50%
const afterBuy = billingSummaryFromAccount(
  { ...base, topUpBalance: 1_000, topUpReference: 1_000, allocationBalance: 20_000 },
  now
)
assert.equal(afterBuy.additionalPct, 100)
assert.equal(afterBuy.remainingPct, 100)

const afterSpend700 = billingSummaryFromAccount(
  { ...base, topUpBalance: 300, topUpReference: 1_000, allocationBalance: 20_000 },
  now
)
assert.equal(afterSpend700.additionalPct, 30)
assert.equal(afterSpend700.remainingPct, 100)

const afterSecondBuy = billingSummaryFromAccount(
  { ...base, topUpBalance: 1_300, topUpReference: 1_300, allocationBalance: 20_000 },
  now
)
assert.equal(afterSecondBuy.additionalPct, 100)
assert.equal(afterSecondBuy.remainingPct, 100)

const afterSpend650 = billingSummaryFromAccount(
  { ...base, topUpBalance: 650, topUpReference: 1_300, allocationBalance: 20_000 },
  now
)
assert.equal(afterSpend650.additionalPct, 50)
assert.equal(afterSpend650.remainingPct, 100)

// Top-up never changes the plan %
const planOnly = billingSummaryFromAccount(
  { ...base, allocationBalance: 10_000, topUpBalance: 0, topUpReference: 0 },
  now
)
const planAfterTopUp = billingSummaryFromAccount(
  { ...base, allocationBalance: 10_000, topUpBalance: 1_000, topUpReference: 1_000 },
  now
)
assert.equal(planOnly.remainingPct, 50)
assert.equal(planAfterTopUp.remainingPct, 50)
assert.equal(planAfterTopUp.additionalPct, 100)

// Hold released after a top-up never shows above 100%
const afterReleaseAboveRef = billingSummaryFromAccount(
  { ...base, topUpBalance: 1_100, topUpReference: 1_000 },
  now
)
assert.equal(afterReleaseAboveRef.additionalPct, 100)

const ended = billingSummaryFromAccount(
  { ...base, currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z') },
  now
)
assert.equal(ended.entitled, false)
assert.equal(ended.status, 'ended')
assert.equal(billingDisplayStatus({ planStatus: 'cancelled', currentPeriodEnd: new Date(0) }, now), 'cancelled')

const pastSched = billingSummaryFromAccount(
  {
    ...base,
    hasScheduledChanges: true,
    scheduledPlanType: 'pro',
    scheduledPlanId: 'plan_x',
    scheduledChangeAt: new Date('2020-01-01T00:00:00.000Z'),
  },
  now
)
assert.equal(pastSched.scheduledChange, null)

const futureSched = billingSummaryFromAccount(
  {
    ...base,
    hasScheduledChanges: true,
    scheduledPlanType: 'pro',
    scheduledPlanId: 'plan_x',
    scheduledChangeAt: new Date('2031-01-01T00:00:00.000Z'),
  },
  now
)
assert.equal(futureSched.scheduledChange?.planType, 'pro')
assert.equal(futureSched.canCancelScheduledChange, false)
assert.equal(summary.canCancelScheduledChange, false)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const billingPage = fs.readFileSync(
  path.join(root, 'app/dashboard/billing/[[...slug]]/page.tsx'),
  'utf8'
)
assert.doesNotMatch(
  billingPage,
  /Cancel change/,
  'billing UI must not offer cancel scheduled (Razorpay cycle-end cancel is irreversible)'
)
assert.doesNotMatch(billingPage, /cancel-scheduled-change/)
for (const rel of [
  'app/api/me/route.ts',
  'app/api/billing/summary/route.ts',
  'app/api/billing/transactions/route.ts',
  'app/api/contact/route.ts',
]) {
  assert.ok(fs.existsSync(path.join(root, rel)), rel)
}

const meRoute = fs.readFileSync(path.join(root, 'app/api/me/route.ts'), 'utf8')
assert.match(meRoute, /export async function GET/)
assert.match(meRoute, /export async function PATCH/)
assert.match(meRoute, /getMePayload/)
assert.match(meRoute, /patchMe/)

const summaryRoute = fs.readFileSync(path.join(root, 'app/api/billing/summary/route.ts'), 'utf8')
assert.match(summaryRoute, /billingSummaryFromAccount/)
assert.doesNotMatch(summaryRoute, /allocationBalance/)

console.log('billingSummary.selfcheck: ok')
