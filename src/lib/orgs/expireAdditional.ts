/**
 * 1-year additional-credit expiry (plan §5.2).
 * Remaining balance belongs to the newest purchases (oldest spent first), so:
 *   expiring = max(0, top_up_balance − sum(inflows with expires_at > now()))
 * Negative top_up ⇒ nothing expires.
 */
import type { TxSql } from '@/lib/db/tx'
import {
  creditTransactionExists,
  insertCreditTransaction,
  lockBillingById,
  updateBillingById,
} from '@/lib/db/wallet'

export type ExpireResult = {
  billingAccountId: string
  expired: number
  rows: number
}

/** Pure: how many additional credits expire given balance + unexpired inflow sum. */
export function additionalExpiringAmount(topUpBalance: number, unexpiredInflowSum: number): number {
  if (topUpBalance < 0) return 0
  return Math.max(0, topUpBalance - Math.max(0, unexpiredInflowSum))
}

/**
 * Expire due top-up inflows for one wallet.
 * Idempotent per inflow via `exp_{inflow_id}`.
 */
export async function expireAdditionalForWallet(
  tx: TxSql,
  billingAccountId: string,
  now: Date = new Date()
): Promise<ExpireResult> {
  const billing = await lockBillingById(tx, billingAccountId)
  if (!billing) {
    return { billingAccountId, expired: 0, rows: 0 }
  }
  if (billing.topUpBalance < 0) {
    // ponytail: held credits released later may return; don't expire into more debt.
    return { billingAccountId, expired: 0, rows: 0 }
  }

  const unexpiredSumRows = await tx`
    select coalesce(sum(amount), 0)::int as s
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and bucket = 'top_up'
      and type in ('grant', 'transfer_in')
      and expires_at is not null
      and expires_at > ${now}
  `
  let toExpire = additionalExpiringAmount(
    billing.topUpBalance,
    Number(unexpiredSumRows[0]?.s ?? 0)
  )
  if (toExpire <= 0) {
    return { billingAccountId, expired: 0, rows: 0 }
  }

  const due = await tx`
    select id, amount
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and bucket = 'top_up'
      and type in ('grant', 'transfer_in')
      and expires_at is not null
      and expires_at <= ${now}
    order by expires_at asc, created_at asc
  `

  let balance = billing.topUpBalance
  let totalExpired = 0
  let rowsWritten = 0

  for (const row of due as Array<Record<string, unknown>>) {
    if (toExpire <= 0) break
    const inflowId = String(row.id)
    const expId = `exp_${inflowId}`
    if (await creditTransactionExists(tx, expId)) continue

    const amount = Math.min(toExpire, Number(row.amount) || 0)
    if (amount <= 0) continue

    await insertCreditTransaction(tx, expId, billingAccountId, {
      user_id: billing.ownerUserId,
      org_id: billing.ownerOrgId,
      type: 'expire',
      amount,
      bucket: 'top_up',
      request_id: expId,
      reason: 'cron.additional_expire',
    })
    balance -= amount
    toExpire -= amount
    totalExpired += amount
    rowsWritten += 1
  }

  if (totalExpired > 0) {
    await updateBillingById(tx, billingAccountId, { topUpBalance: balance })
  }

  return { billingAccountId, expired: totalExpired, rows: rowsWritten }
}

/** All wallets that have at least one due top-up inflow. */
export async function listWalletsWithDueAdditional(
  tx: TxSql,
  now: Date = new Date()
): Promise<string[]> {
  const rows = await tx`
    select distinct billing_account_id
    from credit_transactions
    where bucket = 'top_up'
      and type in ('grant', 'transfer_in')
      and expires_at is not null
      and expires_at <= ${now}
  `
  return rows.map((r) => String(r.billing_account_id))
}
