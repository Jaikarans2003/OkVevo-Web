/**
 * Leave / Remove super-org linkage (AWS Organizations handshake).
 * One transaction: clear parent, restore subscription access_mode, reverse unused
 * sponsored credits, absorb debt the super-org cannot cover from top_up.
 * Open RELEASABLE jobs → 409 jobs_in_flight (caller maps to HTTP).
 */
import { RELEASABLE } from '@/lib/gateway/reserve'
import type { TxSql } from '@/lib/db/tx'
import {
  insertCreditTransaction,
  lockBillingById,
  updateBillingById,
  type BillingAccountData,
} from '@/lib/db/wallet'
import { remainingByInflow, takeFromRemaining, type TopUpInflow } from '@/lib/orgs/inflows'

export type LeaveRemoveFail =
  | { ok: false; code: 'not_found' | 'not_child' | 'jobs_in_flight' | 'forbidden' }
  | {
      ok: true
      debtAbsorbed: number
      debtFromSuperTopUp: number
      sponsoredReturned: number
      previewDebt: number
    }

function openHoldStatuses(): string[] {
  return Array.from(RELEASABLE)
}

/** Preview debt the super-org would pay if Leave/Remove runs now (0 when not overdrawn). */
export function previewLeaveDebt(childSponsoredBalance: number): number {
  return childSponsoredBalance < 0 ? -childSponsoredBalance : 0
}

async function loadSponsoredInflows(
  tx: TxSql,
  billingAccountId: string
): Promise<TopUpInflow[]> {
  const rows = await tx`
    select id, amount, expires_at, created_at
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and bucket = 'sponsored'
      and type in ('transfer_in', 'grant')
      and amount > 0
    order by expires_at asc nulls last, created_at asc
  `
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
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

export async function leaveOrRemoveParent(
  tx: TxSql,
  opts: {
    childOrgId: string
    superOrgId: string
    actorUserId: string
    /** leave = org owner; remove = super-org owner */
    action: 'leave' | 'remove'
  }
): Promise<LeaveRemoveFail> {
  const childRows = await tx`
    select id, parent_id, kind from organizations where id = ${opts.childOrgId} for update
  `
  const child = childRows[0] as Record<string, unknown> | undefined
  if (!child || child.kind !== 'org') return { ok: false, code: 'not_found' }
  if (child.parent_id !== opts.superOrgId) return { ok: false, code: 'not_child' }

  const childWalletRows = await tx`
    select id from billing_accounts where owner_org_id = ${opts.childOrgId}
  `
  const childWalletId = childWalletRows[0]?.id as string | undefined
  const superWalletRows = await tx`
    select id from billing_accounts where owner_org_id = ${opts.superOrgId}
  `
  const superWalletId = superWalletRows[0]?.id as string | undefined
  if (!childWalletId || !superWalletId) return { ok: false, code: 'not_found' }

  // Lock wallets before jobs check so a concurrent reserve cannot commit a
  // RELEASABLE hold onto a wallet we are about to detach (same lock reserve takes).
  const [firstId, secondId] =
    childWalletId < superWalletId
      ? [childWalletId, superWalletId]
      : [superWalletId, childWalletId]
  const first = await lockBillingById(tx, firstId)
  const second = await lockBillingById(tx, secondId)
  const childBa = (first?.id === childWalletId ? first : second) as BillingAccountData
  const superBa = (first?.id === superWalletId ? first : second) as BillingAccountData

  const statuses = openHoldStatuses()
  const openJobs = await tx`
    select id from gateway_jobs
    where billing_account_id = ${childWalletId}
      and status in ${tx(statuses)}
    limit 1
  `
  if (openJobs.length > 0) {
    return { ok: false, code: 'jobs_in_flight' }
  }

  const previewDebt = previewLeaveDebt(childBa.sponsoredBalance)
  let sponsoredReturned = 0
  let debtFromSuperTopUp = 0
  let debtAbsorbed = 0
  let childSponsored = childBa.sponsoredBalance
  let superTopUp = superBa.topUpBalance

  const stamp = Date.now().toString(16)

  if (childSponsored > 0) {
    // Return unused sponsored to super-org: one transfer_in per remaining lot (expires_at).
    sponsoredReturned = childSponsored
    const inflows = await loadSponsoredInflows(tx, childWalletId)
    const remaining = remainingByInflow(inflows, childSponsored)
    const slices = takeFromRemaining(remaining, sponsoredReturned)
    if (slices.length === 0) {
      // Fallback: still move the balance if ledger lots are missing (should not happen).
      await insertCreditTransaction(tx, `leave_${stamp}:out`, childWalletId, {
        user_id: opts.actorUserId,
        org_id: opts.childOrgId,
        super_org_id: opts.superOrgId,
        type: 'transfer_out',
        amount: sponsoredReturned,
        bucket: 'sponsored',
        reason: `org.${opts.action}.return`,
        counterparty_billing_account_id: superWalletId,
      })
      await insertCreditTransaction(tx, `leave_${stamp}:in`, superWalletId, {
        user_id: opts.actorUserId,
        org_id: opts.superOrgId,
        super_org_id: opts.superOrgId,
        type: 'transfer_in',
        amount: sponsoredReturned,
        bucket: 'top_up',
        reason: `org.${opts.action}.return`,
        counterparty_billing_account_id: childWalletId,
      })
    } else {
      await insertCreditTransaction(tx, `leave_${stamp}:out`, childWalletId, {
        user_id: opts.actorUserId,
        org_id: opts.childOrgId,
        super_org_id: opts.superOrgId,
        type: 'transfer_out',
        amount: sponsoredReturned,
        bucket: 'sponsored',
        reason: `org.${opts.action}.return`,
        counterparty_billing_account_id: superWalletId,
      })
      let n = 0
      for (const slice of slices) {
        n += 1
        await insertCreditTransaction(tx, `leave_${stamp}:in:${n}`, superWalletId, {
          user_id: opts.actorUserId,
          org_id: opts.superOrgId,
          super_org_id: opts.superOrgId,
          type: 'transfer_in',
          amount: slice.amount,
          bucket: 'top_up',
          reason: `org.${opts.action}.return`,
          expires_at: slice.expiresAt,
          counterparty_billing_account_id: childWalletId,
        })
      }
    }
    childSponsored = 0
    superTopUp += sponsoredReturned
  } else if (childSponsored < 0) {
    const debt = -childSponsored
    debtFromSuperTopUp = Math.min(debt, Math.max(0, superTopUp))
    debtAbsorbed = debt - debtFromSuperTopUp
    if (debtFromSuperTopUp > 0) {
      superTopUp -= debtFromSuperTopUp
      await insertCreditTransaction(tx, `leave_${stamp}:debt`, superWalletId, {
        user_id: opts.actorUserId,
        org_id: opts.superOrgId,
        super_org_id: opts.superOrgId,
        type: 'debit',
        amount: debtFromSuperTopUp,
        bucket: 'top_up',
        reason: `org.${opts.action}.debt`,
        counterparty_billing_account_id: childWalletId,
      })
    }
    // Close the child's sponsored hole with positive ledger rows (grant / absorbed).
    if (debtFromSuperTopUp > 0) {
      await insertCreditTransaction(tx, `leave_${stamp}:child_grant`, childWalletId, {
        user_id: opts.actorUserId,
        org_id: opts.childOrgId,
        super_org_id: opts.superOrgId,
        type: 'grant',
        amount: debtFromSuperTopUp,
        bucket: 'sponsored',
        reason: `org.${opts.action}.close`,
        counterparty_billing_account_id: superWalletId,
      })
    }
    if (debtAbsorbed > 0) {
      await insertCreditTransaction(tx, `leave_${stamp}:absorbed`, childWalletId, {
        user_id: opts.actorUserId,
        org_id: opts.childOrgId,
        super_org_id: opts.superOrgId,
        type: 'absorbed',
        amount: debtAbsorbed,
        bucket: 'sponsored',
        reason: `org.${opts.action}.absorbed`,
        counterparty_billing_account_id: superWalletId,
      })
      const alertId = `leave-absorb-${opts.childOrgId}-${stamp}`
      await tx`
        insert into ops_alerts (id, data)
        values (
          ${alertId},
          ${JSON.stringify({
            severity: 'HIGH',
            condition: `org.${opts.action}.absorbed`,
            id: alertId,
            text: 'super-org could not cover child sponsored debt',
            childOrgId: opts.childOrgId,
            superOrgId: opts.superOrgId,
            debtAbsorbed,
            resolved: false,
          })}::jsonb
        )
        on conflict (id) do nothing
      `
    }
    childSponsored = 0
  }

  // Clear parent first: billing_accounts_shape_matches_owner requires access_mode=prepaid
  // while parent_id is still set, so flipping access_mode back to subscription must come after.
  await tx`
    update organizations set parent_id = null
    where id = ${opts.childOrgId}
  `

  // Drop the cancelled-at-period-end pointer so the next purchase is
  // first_or_recovery in shouldApplySubscriptionEvent (not stale vs old sub id).
  await updateBillingById(tx, childWalletId, {
    sponsoredBalance: 0,
    sponsoredReference: 0,
    accessMode: 'subscription',
    razorpaySubscriptionId: null,
    cancelAtPeriodEnd: false,
  })
  // Reset topUpReference only when unused sponsored credits return (bought-again bar).
  // Debt paydown must leave the prior reference so additionalPct drops below 100.
  await updateBillingById(tx, superWalletId, {
    topUpBalance: superTopUp,
    ...(sponsoredReturned > 0 ? { topUpReference: superTopUp } : {}),
  })

  await tx`
    insert into audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      ${opts.action === 'leave' ? opts.childOrgId : opts.superOrgId},
      ${opts.actorUserId},
      ${opts.action === 'leave' ? 'org.leave_super' : 'org.remove_child'},
      'organization',
      ${opts.childOrgId},
      ${JSON.stringify({
        superOrgId: opts.superOrgId,
        previewDebt,
        debtFromSuperTopUp,
        debtAbsorbed,
        sponsoredReturned,
      })}::jsonb
    )
  `

  return {
    ok: true,
    debtAbsorbed,
    debtFromSuperTopUp,
    sponsoredReturned,
    previewDebt,
  }
}
