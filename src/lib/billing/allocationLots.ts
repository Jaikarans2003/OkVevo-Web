/**
 * Allocation lots keyed by Razorpay subscription id (Orb / Stripe credit-grant style).
 * Renewal SET replaces only that subscription's open lot; spend draws soonest-expiring first.
 */
import type { DbHandle } from '@/lib/db/wallet'

export type AllocationLot = {
  subscriptionId: string | null
  amount: number
  expiresAt: Date | null
  createdAt: Date
}

export type LotSlice = {
  subscriptionId: string | null
  amount: number
  expiresAt: Date | null
}

/** Remaining per lot after FIFO spend from soonest-expiring. */
export function remainingByLot(
  lots: AllocationLot[],
  allocationBalance: number
): LotSlice[] {
  const ordered = [...lots].sort((a, b) => {
    const ae = a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY
    const be = b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY
    if (ae !== be) return ae - be
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
  const totalIn = ordered.reduce((s, r) => s + r.amount, 0)
  let spent = Math.max(0, totalIn - Math.max(0, allocationBalance))
  const out: LotSlice[] = []
  for (const row of ordered) {
    const remaining = Math.max(0, row.amount - spent)
    spent = Math.max(0, spent - row.amount)
    if (remaining > 0) {
      out.push({
        subscriptionId: row.subscriptionId,
        amount: remaining,
        expiresAt: row.expiresAt,
      })
    }
  }
  return out
}

/** Take `need` from remaining lots (soonest expiry first). */
export function takeFromLots(remaining: LotSlice[], need: number): LotSlice[] {
  if (!Number.isInteger(need) || need <= 0) return []
  let left = need
  const out: LotSlice[] = []
  for (const slice of remaining) {
    if (left <= 0) break
    const take = Math.min(left, slice.amount)
    if (take > 0) {
      out.push({ ...slice, amount: take })
      left -= take
    }
  }
  if (left > 0) return []
  return out
}

/** Remaining for one subscription lot (0 when none). */
export function remainingForSubscription(
  lots: AllocationLot[],
  allocationBalance: number,
  subscriptionId: string
): number {
  const rem = remainingByLot(lots, allocationBalance)
  return rem
    .filter((s) => s.subscriptionId === subscriptionId)
    .reduce((s, r) => s + r.amount, 0)
}

export async function loadAllocationLots(
  db: DbHandle,
  billingAccountId: string
): Promise<AllocationLot[]> {
  const rows = await db`
    select amount, razorpay_subscription_id, expires_at, created_at
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and bucket = 'allocation'
      and type = 'grant'
      and amount > 0
    order by expires_at asc nulls last, created_at asc
  `
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    subscriptionId:
      r.razorpay_subscription_id == null ? null : String(r.razorpay_subscription_id),
    amount: Number(r.amount) || 0,
    expiresAt:
      r.expires_at instanceof Date
        ? r.expires_at
        : r.expires_at
          ? new Date(String(r.expires_at))
          : null,
    createdAt:
      r.created_at instanceof Date ? r.created_at : new Date(String(r.created_at)),
  }))
}
