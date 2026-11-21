/**
 * Child-org credit limit: 1.5% of transfer_in + debt_recovery since 1st of month UTC (§5.2).
 * Non-prepaid wallets → 0.
 */
import type { DbHandle } from '@/lib/db/wallet'

function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

export async function computeCreditLimit(
  db: DbHandle,
  billingAccountId: string,
  now: Date = new Date()
): Promise<number> {
  const modeRows = await db`
    select access_mode from billing_accounts where id = ${billingAccountId}
  `
  if (modeRows[0]?.access_mode !== 'prepaid') return 0

  const since = monthStartUtc(now)
  // 2b-a: 1.5% floor is on sponsored inflows only (top_up never goes negative).
  const rows = await db`
    select coalesce(sum(amount), 0)::int as s
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and type in ('transfer_in', 'debt_recovery')
      and bucket = 'sponsored'
      and created_at >= ${since}
  `
  const received = Number(rows[0]?.s ?? 0)
  return Math.floor(received * 0.015)
}
