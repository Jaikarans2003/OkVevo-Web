/**
 * Server billing summary for GET /api/billing/summary.
 * Percentages only — never return raw allocation/top-up balances.
 */
import { isEntitled } from '@/lib/billing/entitlement'
import type { BillingAccountData } from '@/lib/db/wallet'
import { additionalRemainingPct, remainingPct } from '@/types/credits'

export type BillingSummary = {
  plan: string | null
  planName: string | null
  status: string | null
  entitled: boolean
  remainingPct: number
  additionalPct: number
  additionalNextExpiry: string | null
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  scheduledChange: {
    planType: string | null
    planId: string | null
    changeAt: string | null
  } | null
  /**
   * Always false for Razorpay India plan changes: after the replacement is
   * authenticated, the current sub is cancelled at cycle end and that cancel
   * cannot be undone.
   */
  canCancelScheduledChange: boolean
  accountKind: string
  canPurchase: boolean
  fundedBy: string | null
  billingCycle: string | null
  currency: string | null
  paymentMethod: string | null
  razorpaySubscriptionId: string | null
}

function iso(d: Date | null | undefined): string | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** UI status: past periodEnd while planStatus is still active → "ended". */
export function billingDisplayStatus(
  billing: Pick<BillingAccountData, 'planStatus' | 'currentPeriodEnd'>,
  now: Date = new Date()
): string | null {
  const status = billing.planStatus
  if (!status) return null
  if (
    status === 'active' &&
    billing.currentPeriodEnd instanceof Date &&
    !Number.isNaN(billing.currentPeriodEnd.getTime()) &&
    now.getTime() >= billing.currentPeriodEnd.getTime()
  ) {
    return 'ended'
  }
  return status
}

export function billingSummaryFromAccount(
  billing: BillingAccountData | undefined,
  now: Date = new Date()
): BillingSummary {
  if (!billing) {
    return {
      plan: null,
      planName: null,
      status: null,
      entitled: false,
      remainingPct: 0,
      additionalPct: 0,
      additionalNextExpiry: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      scheduledChange: null,
      canCancelScheduledChange: false,
      accountKind: 'individual',
      canPurchase: true,
      fundedBy: null,
      billingCycle: null,
      currency: null,
      paymentMethod: null,
      razorpaySubscriptionId: null,
    }
  }

  const entitled = isEntitled(billing, now)
  const hasScheduled =
    billing.hasScheduledChanges &&
    (!billing.scheduledChangeAt ||
      !(billing.scheduledChangeAt instanceof Date) ||
      billing.scheduledChangeAt.getTime() > now.getTime())
  // Child orgs (prepaid) never buy; fundedBy filled when summary is resolved with org context.
  const canPurchase = billing.accessMode !== 'prepaid'

  return {
    plan: billing.plan,
    planName: billing.planName,
    status: billingDisplayStatus(billing, now),
    entitled,
    remainingPct: remainingPct(
      billing.creditsIncluded,
      billing.allocationBalance,
      billing.allocationGrantedTotal
    ),
    additionalPct: additionalRemainingPct(billing.topUpBalance, billing.topUpReference),
    // PR 1: top-ups have no expiry column yet (PR 2).
    additionalNextExpiry: null,
    periodEnd: iso(billing.currentPeriodEnd),
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
    scheduledChange: hasScheduled
      ? {
          planType: billing.scheduledPlanType,
          planId: billing.scheduledPlanId,
          changeAt: iso(billing.scheduledChangeAt),
        }
      : null,
    canCancelScheduledChange: false,
    accountKind: billing.accountKind,
    canPurchase,
    fundedBy: null,
    billingCycle: billing.billingCycle,
    currency: billing.currency,
    paymentMethod: billing.paymentMethod,
    razorpaySubscriptionId: billing.razorpaySubscriptionId,
  }
}
