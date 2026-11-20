/**
 * Super-org → child-org top-up transfer (Stripe Connect pattern).
 * Oldest-expiry source purchases; debt recovery before transfer_in; top_up_reference reset.
 * Idempotency keys are scoped to the source wallet (Stripe-style).
 */
import { isEntitled } from '@/lib/billing/entitlement'
import type { TxSql } from '@/lib/db/tx'
import {
  getBillingByOrgId,
  insertCreditTransaction,
  lockBillingById,
  updateBillingById,
  type BillingAccountData,
} from '@/lib/db/wallet'
import { remainingByInflow, takeFromRemaining, type TopUpInflow } from '@/lib/orgs/inflows'

export type TransferFailCode =
  | 'not_found'
  | 'not_child'
  | 'plan_not_active'
  | 'insufficient_quota'
  | 'invalid_amount'
  | 'idempotency_conflict'

export type TransferResult =
  | {
      ok: true
      transferred: number
      debtRecovered: number
      fromBalance: number
      toBalance: number
      idempotent: boolean
    }
  | { ok: false; code: TransferFailCode }

/** Ledger ids include the source wallet so two super-orgs can reuse the same client key. */
export function transferLedgerIds(sourceWalletId: string, idempotencyKey: string) {
  const base = `xfer_${sourceWalletId}_${idempotencyKey}`
  return {
    out: `${base}:out`,
    debt: `${base}:debt`,
    in: (n: number) => `${base}:in:${n}`,
  }
}

async function loadTopUpInflows(tx: TxSql, billingAccountId: string): Promise<TopUpInflow[]> {
  const rows = await tx`
    select id, amount, expires_at, created_at
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and bucket = 'top_up'
      and type in ('grant', 'transfer_in')
      and amount > 0
    order by expires_at asc nulls last, created_at asc
  `
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    amount: Number(r.amount) || 0,
    expiresAt: r.expires_at instanceof Date ? r.expires_at : r.expires_at ? new Date(String(r.expires_at)) : null,
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(String(r.created_at)),
  }))
}

async function loadOutRow(
  tx: TxSql,
  outId: string
): Promise<{ amount: number; counterparty: string | null } | null> {
  const rows = await tx`
    select amount, counterparty_billing_account_id
    from credit_transactions
    where id = ${outId}
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  return {
    amount: Number(row.amount) || 0,
    counterparty:
      row.counterparty_billing_account_id == null
        ? null
        : String(row.counterparty_billing_account_id),
  }
}

async function replayOrConflict(
  tx: TxSql,
  opts: {
    outId: string
    expectedAmount: number
    expectedCounterpartyId: string
    fromOrgId: string
    toOrgId: string
  }
): Promise<TransferResult | null> {
  const existing = await loadOutRow(tx, opts.outId)
  if (!existing) return null
  if (
    existing.amount !== opts.expectedAmount ||
    existing.counterparty !== opts.expectedCounterpartyId
  ) {
    return { ok: false, code: 'idempotency_conflict' }
  }
  const from = await getBillingByOrgId(tx, opts.fromOrgId)
  const to = await getBillingByOrgId(tx, opts.toOrgId)
  return {
    ok: true,
    transferred: opts.expectedAmount,
    debtRecovered: 0,
    fromBalance: from?.topUpBalance ?? 0,
    toBalance: to?.topUpBalance ?? 0,
    idempotent: true,
  }
}

export async function transferCredits(
  tx: TxSql,
  opts: {
    fromSuperOrgId: string
    toOrgId: string
    credits: number
    idempotencyKey: string
    actorUserId: string
  }
): Promise<TransferResult> {
  const { fromSuperOrgId, toOrgId, credits, idempotencyKey, actorUserId } = opts
  if (!Number.isInteger(credits) || credits <= 0) {
    return { ok: false, code: 'invalid_amount' }
  }
  if (!idempotencyKey.trim()) {
    return { ok: false, code: 'invalid_amount' }
  }

  const fromWallet = await getBillingByOrgId(tx, fromSuperOrgId)
  const toWallet = await getBillingByOrgId(tx, toOrgId)
  if (!fromWallet || !toWallet) return { ok: false, code: 'not_found' }

  const ids = transferLedgerIds(fromWallet.id, idempotencyKey)

  // Fast path before locks (same key + same params → replay).
  const early = await replayOrConflict(tx, {
    outId: ids.out,
    expectedAmount: credits,
    expectedCounterpartyId: toWallet.id,
    fromOrgId: fromSuperOrgId,
    toOrgId,
  })
  if (early) return early

  const childRows = await tx`
    select id, parent_id, kind from organizations where id = ${toOrgId} for update
  `
  const child = childRows[0] as Record<string, unknown> | undefined
  if (!child || child.parent_id !== fromSuperOrgId || child.kind !== 'org') {
    return { ok: false, code: 'not_child' }
  }

  // Lock in id order to avoid deadlocks.
  const [firstId, secondId] =
    fromWallet.id < toWallet.id
      ? [fromWallet.id, toWallet.id]
      : [toWallet.id, fromWallet.id]
  const first = await lockBillingById(tx, firstId)
  const second = await lockBillingById(tx, secondId)
  const from = (first?.id === fromWallet.id ? first : second) as BillingAccountData
  const to = (first?.id === toWallet.id ? first : second) as BillingAccountData

  // Re-check after locks so two identical concurrent requests return the same result.
  const afterLock = await replayOrConflict(tx, {
    outId: ids.out,
    expectedAmount: credits,
    expectedCounterpartyId: to.id,
    fromOrgId: fromSuperOrgId,
    toOrgId,
  })
  if (afterLock) return afterLock

  if (!isEntitled(from)) {
    return { ok: false, code: 'plan_not_active' }
  }
  if (from.topUpBalance < credits) {
    return { ok: false, code: 'insufficient_quota' }
  }

  const inflows = await loadTopUpInflows(tx, from.id)
  const remaining = remainingByInflow(inflows, from.topUpBalance)
  const slices = takeFromRemaining(remaining, credits)
  if (slices.length === 0) {
    return { ok: false, code: 'insufficient_quota' }
  }

  // Claim the scoped out id before mutating balances (Stripe idempotency).
  const claimed = await tx`
    insert into credit_transactions (
      id, billing_account_id, user_id, org_id, super_org_id,
      type, amount, bucket, request_id, reason, counterparty_billing_account_id
    ) values (
      ${ids.out}, ${from.id}, ${actorUserId}, ${fromSuperOrgId}, ${fromSuperOrgId},
      'transfer_out', ${credits}, 'top_up', ${idempotencyKey}, 'org.transfer', ${to.id}
    )
    on conflict (id) do nothing
    returning id
  `
  if (claimed.length === 0) {
    const raced = await replayOrConflict(tx, {
      outId: ids.out,
      expectedAmount: credits,
      expectedCounterpartyId: to.id,
      fromOrgId: fromSuperOrgId,
      toOrgId,
    })
    if (raced) return raced
    return { ok: false, code: 'idempotency_conflict' }
  }

  const fromNext = from.topUpBalance - credits
  await updateBillingById(tx, from.id, { topUpBalance: fromNext })

  let repay = 0
  let toBalance = to.topUpBalance
  if (toBalance < 0) {
    repay = Math.min(credits, -toBalance)
  }

  // Debt recovery consumes soonest-expiring slices first.
  let debtLeft = repay
  const transferSlices: typeof slices = []
  for (const slice of slices) {
    let amt = slice.amount
    if (debtLeft > 0) {
      const use = Math.min(debtLeft, amt)
      debtLeft -= use
      amt -= use
    }
    if (amt > 0) {
      transferSlices.push({ ...slice, amount: amt })
    }
  }

  if (repay > 0) {
    toBalance += repay
    await insertCreditTransaction(tx, ids.debt, to.id, {
      user_id: actorUserId,
      org_id: toOrgId,
      super_org_id: fromSuperOrgId,
      type: 'debt_recovery',
      amount: repay,
      bucket: 'top_up',
      request_id: idempotencyKey,
      reason: 'org.transfer.debt',
      counterparty_billing_account_id: from.id,
    })
  }

  let n = 0
  for (const slice of transferSlices) {
    n += 1
    toBalance += slice.amount
    await insertCreditTransaction(tx, ids.in(n), to.id, {
      user_id: actorUserId,
      org_id: toOrgId,
      super_org_id: fromSuperOrgId,
      type: 'transfer_in',
      amount: slice.amount,
      bucket: 'top_up',
      request_id: idempotencyKey,
      reason: 'org.transfer',
      expires_at: slice.expiresAt,
      counterparty_billing_account_id: from.id,
    })
  }

  const toPatch: Record<string, unknown> = { topUpBalance: toBalance }
  if (toBalance > 0) {
    // Additional % bar → 100% after a net-positive received balance.
    toPatch.topUpReference = toBalance
  }
  await updateBillingById(tx, to.id, toPatch)

  return {
    ok: true,
    transferred: credits,
    debtRecovered: repay,
    fromBalance: fromNext,
    toBalance,
    idempotent: false,
  }
}
