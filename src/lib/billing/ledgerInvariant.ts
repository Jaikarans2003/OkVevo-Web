/**
 * Nightly wallet ↔ ledger invariant (Modern Treasury style):
 * cached balance + open holds must equal the signed ledger sum per bucket.
 * Open holds (RELEASABLE statuses) reduce the cached balance before a debit
 * row exists; settled debits are negative ledger rows.
 */
import type { Sql } from 'postgres'

import { RELEASABLE } from '@/lib/gateway/reserve'

export type LedgerMismatch = {
  billingAccountId: string
  allocationBalance: number
  topUpBalance: number
  ledgerAlloc: number
  ledgerTopUp: number
  holdAlloc: number
  holdTopUp: number
  allocDelta: number
  topUpDelta: number
}

const OPEN_HOLD_STATUSES = Array.from(RELEASABLE)

/** Pure compare used by the SQL path and selfchecks. */
export function ledgerBucketDelta(
  cached: number,
  ledger: number,
  hold: number
): number {
  return cached - (ledger - hold)
}

/**
 * Scan every wallet. Empty array = healthy.
 * Debit/expire rows store positive `amount` with type; grants are positive.
 * Null bucket on a debit is treated as allocation (current settle path).
 */
export async function findLedgerMismatches(db: Sql): Promise<LedgerMismatch[]> {
  const rows = await db`
    with signed as (
      select
        billing_account_id,
        case
          when type in ('grant', 'transfer_in', 'topup', 'top_up', 'refund', 'release')
            then amount
          when type in ('debit', 'expire', 'transfer_out', 'debt_recovery', 'forfeit')
            then -amount
          else 0
        end as signed_amount,
        coalesce(bucket, 'allocation') as bucket
      from credit_transactions
    ),
    ledger as (
      select
        billing_account_id,
        coalesce(sum(case when bucket = 'allocation' then signed_amount else 0 end), 0)::bigint
          as ledger_alloc,
        coalesce(sum(case when bucket = 'top_up' then signed_amount else 0 end), 0)::bigint
          as ledger_topup
      from signed
      group by billing_account_id
    ),
    holds as (
      select
        billing_account_id,
        coalesce(sum(held_allocation), 0)::bigint as hold_alloc,
        coalesce(sum(held_top_up), 0)::bigint as hold_topup
      from gateway_jobs
      where status in ${db(OPEN_HOLD_STATUSES)}
      group by billing_account_id
    )
    select
      ba.id as billing_account_id,
      ba.allocation_balance::bigint as allocation_balance,
      ba.top_up_balance::bigint as top_up_balance,
      coalesce(l.ledger_alloc, 0)::bigint as ledger_alloc,
      coalesce(l.ledger_topup, 0)::bigint as ledger_topup,
      coalesce(h.hold_alloc, 0)::bigint as hold_alloc,
      coalesce(h.hold_topup, 0)::bigint as hold_topup
    from billing_accounts ba
    left join ledger l on l.billing_account_id = ba.id
    left join holds h on h.billing_account_id = ba.id
  `

  const out: LedgerMismatch[] = []
  for (const r of rows) {
    const allocationBalance = Number(r.allocation_balance)
    const topUpBalance = Number(r.top_up_balance)
    const ledgerAlloc = Number(r.ledger_alloc)
    const ledgerTopUp = Number(r.ledger_topup)
    const holdAlloc = Number(r.hold_alloc)
    const holdTopUp = Number(r.hold_topup)
    const allocDelta = ledgerBucketDelta(allocationBalance, ledgerAlloc, holdAlloc)
    const topUpDelta = ledgerBucketDelta(topUpBalance, ledgerTopUp, holdTopUp)
    if (allocDelta !== 0 || topUpDelta !== 0) {
      out.push({
        billingAccountId: String(r.billing_account_id),
        allocationBalance,
        topUpBalance,
        ledgerAlloc,
        ledgerTopUp,
        holdAlloc,
        holdTopUp,
        allocDelta,
        topUpDelta,
      })
    }
  }
  return out
}
