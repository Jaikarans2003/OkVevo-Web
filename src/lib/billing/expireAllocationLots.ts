/**
 * Expire allocation lots past their own expires_at (cancelled plan end).
 * Does not touch top_up or sponsored. Safe on prepaid wallets.
 */
import type { TxSql } from '@/lib/db/tx'
import {
  loadAllocationLots,
  remainingByLot,
} from '@/lib/billing/allocationLots'
import type { DbHandle } from '@/lib/db/wallet'
import { insertCreditTransaction, lockBillingById, updateBillingById } from '@/lib/db/wallet'

export async function expireAllocationLotsForWallet(
  tx: TxSql,
  billingAccountId: string,
  now: Date = new Date()
): Promise<{ expired: number }> {
  const billing = await lockBillingById(tx, billingAccountId)
  if (!billing) return { expired: 0 }

  const lots = await loadAllocationLots(tx, billingAccountId)
  const remaining = remainingByLot(lots, billing.allocationBalance)
  let expired = 0
  let alloc = billing.allocationBalance
  const stamp = now.getTime().toString(16)

  for (const slice of remaining) {
    if (!slice.expiresAt || slice.expiresAt.getTime() > now.getTime()) continue
    if (slice.amount <= 0) continue
    const subKey = slice.subscriptionId ?? 'none'
    await insertCreditTransaction(
      tx,
      `expire_alloc_${billingAccountId}_${subKey}_${stamp}`,
      billingAccountId,
      {
        user_id: billing.ownerUserId,
        org_id: billing.ownerOrgId,
        type: 'expire',
        amount: slice.amount,
        bucket: 'allocation',
        reason: 'allocation.lot_expired',
        razorpay_subscription_id: slice.subscriptionId,
      }
    )
    alloc -= slice.amount
    expired += slice.amount
  }

  if (expired > 0) {
    await updateBillingById(tx, billingAccountId, {
      allocationBalance: Math.max(0, alloc),
    })
  }
  return { expired }
}

export async function listWalletsWithDueAllocationLots(
  db: DbHandle,
  now: Date = new Date()
): Promise<string[]> {
  const rows = await db`
    select distinct billing_account_id as id
    from credit_transactions
    where bucket = 'allocation'
      and type = 'grant'
      and expires_at is not null
      and expires_at <= ${now}
  `
  return rows.map((r) => String((r as { id: string }).id))
}
