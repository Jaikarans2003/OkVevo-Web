/**
 * Credits Service — client reads via OkVevo HTTP APIs.
 * Server computes percentages; raw balances never leave the API.
 */

import type { User } from 'firebase/auth'

import { authedJson } from '@/lib/api/browser'
import type { BillingSummary } from '@/lib/api/billingSummary'

export type CreditTransaction = {
  id: string
  type: string
  amount: number
  provider?: string | null
  model?: string | null
  createdAt: Date
}

export type BillingSnapshot = {
  plan: string | null
  planName: string | null
  planStatus: string | null
  entitled: boolean
  billingCycle: string | null
  currency: 'USD' | 'INR' | null
  remainingPct: number
  additionalPct: number
  additionalNextExpiry: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  razorpaySubscriptionId: string | null
  hasScheduledChanges: boolean
  scheduledPlanType: string | null
  scheduledChangeAt: Date | null
  paymentMethod: string | null
  canPurchase: boolean
  fundedBy: string | null
  accountKind: string
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function billingSnapshotFromSummary(data: BillingSummary): BillingSnapshot {
  return {
    plan: data.plan,
    planName: data.planName,
    planStatus: data.status,
    entitled: data.entitled,
    billingCycle: data.billingCycle,
    currency: data.currency === 'INR' || data.currency === 'USD' ? data.currency : null,
    remainingPct: data.remainingPct,
    additionalPct: data.additionalPct,
    additionalNextExpiry: toDate(data.additionalNextExpiry),
    currentPeriodEnd: toDate(data.periodEnd),
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    razorpaySubscriptionId: data.razorpaySubscriptionId,
    hasScheduledChanges: data.scheduledChange != null,
    scheduledPlanType: data.scheduledChange?.planType ?? null,
    scheduledChangeAt: toDate(data.scheduledChange?.changeAt),
    paymentMethod: data.paymentMethod,
    canPurchase: data.canPurchase,
    fundedBy: data.fundedBy,
    accountKind: data.accountKind,
  }
}

export function emptyBillingSnapshot(): BillingSnapshot {
  return billingSnapshotFromSummary({
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
  })
}

export async function getBillingSnapshot(user: User): Promise<BillingSnapshot> {
  const data = await authedJson<BillingSummary>(user, '/api/billing/summary')
  return billingSnapshotFromSummary(data)
}

/**
 * Poll billing summary while the UI is open (30 s), on window focus, and once immediately.
 */
export function subscribeUserBilling(
  user: User,
  onData: (snap: BillingSnapshot) => void,
  onError?: (err: Error) => void
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setInterval> | null = null

  const pull = async () => {
    try {
      const snap = await getBillingSnapshot(user)
      if (!stopped) onData(snap)
    } catch (err) {
      if (!stopped) onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  void pull()
  timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    void pull()
  }, 30_000)

  const onFocus = () => void pull()
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onFocus)
  }

  return () => {
    stopped = true
    if (timer) clearInterval(timer)
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocus)
    }
  }
}

export async function getCreditHistory(user: User, limitCount: number = 50): Promise<CreditTransaction[]> {
  const data = await authedJson<{ items: Array<Record<string, unknown>> }>(
    user,
    '/api/billing/transactions'
  )
  return (data.items ?? []).slice(0, limitCount).map((row) => ({
    id: String(row.id),
    type: String(row.type),
    amount: Number(row.amount) || 0,
    provider: (row.provider as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    createdAt: toDate(String(row.createdAt)) ?? new Date(0),
  }))
}
