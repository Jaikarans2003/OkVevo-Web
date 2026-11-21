/**
 * Org accepts super-org parentage (AWS Organizations handshake).
 * One transaction: set parent_id + access_mode=prepaid. Own plan/top_up stay.
 * Caller cancels Razorpay after commit via cancelSubscriptionAtPeriodEndAfterCommit.
 */
import type { TxSql } from '@/lib/db/tx'
import { getBillingByOrgId, updateBillingById } from '@/lib/db/wallet'

export type AcceptParentResult =
  | {
      ok: true
      billingAccountId: string
      razorpaySubscriptionId: string | null
      allocationBalance: number
      topUpBalance: number
    }
  | {
      ok: false
      code: 'not_found' | 'not_org' | 'already_parented' | 'bad_super' | 'no_wallet'
    }

export async function acceptParent(
  tx: TxSql,
  opts: { childOrgId: string; superOrgId: string }
): Promise<AcceptParentResult> {
  const childRows = await tx`
    select id, kind, parent_id from organizations where id = ${opts.childOrgId} for update
  `
  const child = childRows[0] as Record<string, unknown> | undefined
  if (!child) return { ok: false, code: 'not_found' }
  if (child.kind !== 'org') return { ok: false, code: 'not_org' }
  if (child.parent_id) return { ok: false, code: 'already_parented' }

  const superRows = await tx`
    select id, kind from organizations where id = ${opts.superOrgId} for update
  `
  const superOrg = superRows[0] as Record<string, unknown> | undefined
  if (!superOrg || superOrg.kind !== 'super_org') {
    return { ok: false, code: 'bad_super' }
  }

  const billing = await getBillingByOrgId(tx, opts.childOrgId)
  if (!billing) return { ok: false, code: 'no_wallet' }

  await tx`
    update organizations set parent_id = ${opts.superOrgId}
    where id = ${opts.childOrgId}
  `
  await updateBillingById(tx, billing.id, { accessMode: 'prepaid' })

  return {
    ok: true,
    billingAccountId: billing.id,
    razorpaySubscriptionId: billing.razorpaySubscriptionId,
    allocationBalance: billing.allocationBalance,
    topUpBalance: billing.topUpBalance,
  }
}
