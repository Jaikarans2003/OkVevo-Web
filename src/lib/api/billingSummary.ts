/**
 * Server billing summary for GET /api/billing/summary.
 * Percentages only — never return raw allocation/top-up/sponsored balances.
 */
import { isEntitled } from '@/lib/billing/entitlement'
import type { BillingAccountData, DbHandle } from '@/lib/db/wallet'
import { overdrawnPct } from '@/lib/orgs/overdrawn'
import { additionalRemainingPct, flooredPct, remainingPct } from '@/types/credits'

export type BillingSummary = {
  plan: string | null
  planName: string | null
  status: string | null
  entitled: boolean
  remainingPct: number
  additionalPct: number
  additionalNextExpiry: string | null
  /** Sponsored bar: balance/reference when > 0, else 0. */
  sponsoredPct: number
  /** Overdrawn % of this month's 1.5% limit (0 when not overdrawn). */
  overdrawnPct: number
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

export type BillingSummaryExtras = {
  additionalNextExpiry?: string | null
  fundedBy?: string | null
  /** When false, hides buy/change even for subscription wallets (non-owner). */
  canPurchase?: boolean
  /** This month's 1.5% credit limit (for overdrawnPct). */
  creditLimit?: number
}

export function sponsoredRemainingPct(
  sponsoredBalance: number,
  sponsoredReference: number
): number {
  if (sponsoredBalance <= 0) return 0
  return flooredPct(sponsoredBalance, Math.max(0, sponsoredReference))
}

export function billingSummaryFromAccount(
  billing: BillingAccountData | undefined,
  now: Date = new Date(),
  extras: BillingSummaryExtras = {}
): BillingSummary {
  if (!billing) {
    return {
      plan: null,
      planName: null,
      status: null,
      entitled: false,
      remainingPct: 0,
      additionalPct: 0,
      additionalNextExpiry: extras.additionalNextExpiry ?? null,
      sponsoredPct: 0,
      overdrawnPct: 0,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      scheduledChange: null,
      canCancelScheduledChange: false,
      accountKind: 'individual',
      canPurchase: extras.canPurchase ?? true,
      fundedBy: extras.fundedBy ?? null,
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
  const canPurchase =
    extras.canPurchase ?? billing.accessMode !== 'prepaid'
  const creditLimit = extras.creditLimit ?? 0

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
    additionalNextExpiry: extras.additionalNextExpiry ?? null,
    sponsoredPct: sponsoredRemainingPct(
      billing.sponsoredBalance,
      billing.sponsoredReference
    ),
    overdrawnPct: overdrawnPct(billing.sponsoredBalance, creditLimit),
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
    fundedBy: extras.fundedBy ?? null,
    billingCycle: billing.billingCycle,
    currency: billing.currency,
    paymentMethod: billing.paymentMethod,
    razorpaySubscriptionId: billing.razorpaySubscriptionId,
  }
}

/** Soonest unexpired top-up inflow expiry (ISO), or null. */
export async function loadAdditionalNextExpiry(
  db: DbHandle,
  billingAccountId: string,
  now: Date = new Date()
): Promise<string | null> {
  const rows = await db`
    select min(expires_at) as next
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and bucket = 'top_up'
      and type in ('grant', 'transfer_in')
      and expires_at is not null
      and expires_at > ${now}
  `
  const next = rows[0]?.next
  if (!next) return null
  const d = next instanceof Date ? next : new Date(String(next))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
