/**
 * Server-side org/super-org dashboard payload (2b-c).
 * Exact credit fields require admin+; members get % / own usage only via other routes.
 */
import { sponsoredRemainingPct } from '@/lib/api/billingSummary'
import { decodeCursor, encodeCursor } from '@/lib/analytics/cursor'
import type { BillingAccountData, DbHandle } from '@/lib/db/wallet'
import { computeCreditLimit } from '@/lib/orgs/creditLimit'
import {
  owedByOrganisationsTotal,
  overdrawnPct,
  overdrawnSentence,
  owesCredits,
  transferRepayAddedSplit,
} from '@/lib/orgs/dashboardHelpers'
import { usagePeriodWindow } from '@/lib/orgs/periodWindow'
import { additionalRemainingPct, remainingPct } from '@/types/credits'

export function walletPctSummary(billing: BillingAccountData | null | undefined) {
  if (!billing) return null
  return {
    accountKind: billing.accountKind,
    accessMode: billing.accessMode,
    remainingPct: remainingPct(
      billing.creditsIncluded,
      billing.allocationBalance,
      billing.allocationGrantedTotal
    ),
    additionalPct: additionalRemainingPct(billing.topUpBalance, billing.topUpReference),
    sponsoredPct: sponsoredRemainingPct(
      billing.sponsoredBalance,
      billing.sponsoredReference
    ),
    canPurchase: billing.accessMode !== 'prepaid',
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
    periodEnd: billing.currentPeriodEnd?.toISOString?.() ?? null,
    plan: billing.plan,
    planName: billing.planName,
    billingCycle: billing.billingCycle,
  }
}

export async function buildChildOrgRow(
  db: DbHandle,
  opts: {
    publicId: string
    name: string
    kind: string
    billing: BillingAccountData | null
    now?: Date
  }
) {
  const now = opts.now ?? new Date()
  const billing = opts.billing
  const wallet = walletPctSummary(billing)
  if (!billing) {
    return {
      publicId: opts.publicId,
      name: opts.name,
      kind: opts.kind,
      wallet,
      active: false,
      creditsUsed: 0,
      memberCount: 0,
      owesPct: 0,
      owesCredits: 0,
    }
  }

  const limit = await computeCreditLimit(db, billing.id, now)
  const window = usagePeriodWindow({
    accessMode: billing.accessMode,
    billingCycle: billing.billingCycle,
    currentPeriodEnd: billing.currentPeriodEnd,
    now,
  })

  const usageRows = await db`
    select coalesce(sum(credits), 0)::int as credits
    from usage_daily
    where org_id = ${billing.ownerOrgId}
      and day >= ${window.from}
      and day < ${window.to}
  `
  const creditsUsed = Number(usageRows[0]?.credits ?? 0)

  const memberRows = await db`
    select count(*)::int as n
    from memberships
    where org_id = ${billing.ownerOrgId} and status = 'active'
  `
  const memberCount = Number(memberRows[0]?.n ?? 0)

  const activeRows = await db`
    select exists(
      select 1 from usage_daily
      where org_id = ${billing.ownerOrgId}
        and credits > 0
        and day >= ${new Date(now.getTime() - 30 * 864e5)}
    ) as active
  `
  const active = Boolean(activeRows[0]?.active)

  return {
    publicId: opts.publicId,
    name: opts.name,
    kind: opts.kind,
    wallet: {
      ...wallet,
      overdrawnPct: overdrawnPct(billing.sponsoredBalance, limit),
    },
    active,
    creditsUsed,
    memberCount,
    owesPct: overdrawnPct(billing.sponsoredBalance, limit),
    owesCredits: owesCredits(billing.sponsoredBalance),
    sponsoredBalance: billing.sponsoredBalance,
  }
}

export async function buildAdminExactCredits(
  db: DbHandle,
  opts: {
    billing: BillingAccountData | null
    childrenSponsoredBalances: number[]
    parentName: string | null
    creditLimit: number
  }
) {
  const billing = opts.billing
  const availableToSend = billing?.topUpBalance ?? 0
  const owedTotal = owedByOrganisationsTotal(opts.childrenSponsoredBalances)
  const odPct =
    billing != null ? overdrawnPct(billing.sponsoredBalance, opts.creditLimit) : 0
  return {
    availableToSend,
    availableToSendLabel: `Available to send: ${availableToSend} credits`,
    owedByOrganisations: owedTotal,
    overdrawnSentence:
      odPct > 0 && opts.parentName
        ? overdrawnSentence(odPct, opts.parentName)
        : null,
  }
}

/** Group child transfer_in + debt_recovery by request_id (idempotency key). Keyset-paged. */
export async function listTransferReceipts(
  db: DbHandle,
  opts: {
    childBillingAccountId: string
    superOrgName: string
    limit?: number
    cursor?: string | null
  }
): Promise<{ items: TransferReceipt[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 50)
  const cursor = decodeCursor(opts.cursor ?? null)
  const rows = await db`
    select request_id,
           sum(case when type = 'debt_recovery' then amount else 0 end)::int as repaid,
           sum(case when type = 'transfer_in' then amount else 0 end)::int as added,
           max(created_at) as created_at
    from credit_transactions
    where billing_account_id = ${opts.childBillingAccountId}
      and type in ('transfer_in', 'debt_recovery')
      and bucket = 'sponsored'
      and request_id is not null
    group by request_id
    ${cursor ? db`having (max(created_at), request_id) < (${cursor.at}::timestamptz, ${cursor.id})` : db``}
    order by max(created_at) desc, request_id desc
    limit ${limit + 1}
  `
  const page = rows.slice(0, limit)
  const items: TransferReceipt[] = page.map((r) => {
    const repaid = Number(r.repaid ?? 0)
    const added = Number(r.added ?? 0)
    const total = repaid + added
    const split = transferRepayAddedSplit({ transferred: total, debtRecovered: repaid })
    return {
      requestId: String(r.request_id),
      total,
      repaid: split.repaid,
      added: split.added,
      createdAt: (r.created_at as Date).toISOString(),
      label: `Received ${total} credits from ${opts.superOrgName} (${split.repaid} repaid, ${split.added} added)`,
    }
  })
  const last = page[page.length - 1]
  const nextCursor =
    rows[limit] && last ? encodeCursor(last.createdAt, last.requestId) : null
  return { items, nextCursor }
}

export type TransferReceipt = {
  requestId: string
  total: number
  repaid: number
  added: number
  createdAt: string
  label: string
}

export type SuperOrgTransfer = {
  id: string
  requestId: string
  transferred: number
  repaid: number
  added: number
  childPublicId: string | null
  childName: string | null
  createdAt: string
}

/**
 * Super-org outbound transfers with repay/added split from child ledgers.
 * One SQL query per page (lateral split + child join), keyset-paged,
 * optional `to` filter on the child public id.
 */
export async function listSuperOrgTransfers(
  db: DbHandle,
  opts: {
    superOrgId: string
    superBillingAccountId: string
    limit?: number
    cursor?: string | null
    to?: string | null
  }
): Promise<{ items: SuperOrgTransfer[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 50)
  const cursor = decodeCursor(opts.cursor ?? null)
  const rows = await db`
    select t.id, t.amount, t.request_id, t.created_at,
           o.public_id as child_public_id, o.name as child_name,
           s.repaid, s.added
    from credit_transactions t
    left join billing_accounts cb on cb.id = t.counterparty_billing_account_id
    left join organizations o on o.id = cb.owner_org_id
    cross join lateral (
      select
        coalesce(sum(case when c.type = 'debt_recovery' then c.amount else 0 end), 0)::int as repaid,
        coalesce(sum(case when c.type = 'transfer_in' then c.amount else 0 end), 0)::int as added
      from credit_transactions c
      where c.billing_account_id = t.counterparty_billing_account_id
        and c.request_id = t.request_id
        and c.type in ('transfer_in', 'debt_recovery')
    ) s
    where t.billing_account_id = ${opts.superBillingAccountId}
      and t.type = 'transfer_out'
      and t.reason = 'org.transfer'
      ${opts.to ? db`and o.public_id = ${opts.to}` : db``}
      ${cursor ? db`and (t.created_at, t.id) < (${cursor.at}::timestamptz, ${cursor.id})` : db``}
    order by t.created_at desc, t.id desc
    limit ${limit + 1}
  `
  const page = rows.slice(0, limit)
  const items: SuperOrgTransfer[] = page.map((row) => {
    const transferred = Number(row.amount) || 0
    const split = transferRepayAddedSplit({
      transferred,
      debtRecovered: Number(row.repaid ?? 0),
    })
    return {
      id: String(row.id),
      requestId: String(row.request_id ?? ''),
      transferred,
      repaid: split.repaid,
      added: split.added,
      childPublicId: row.child_public_id == null ? null : String(row.child_public_id),
      childName: row.child_name == null ? null : String(row.child_name),
      createdAt: (row.created_at as Date).toISOString(),
    }
  })
  const last = items[items.length - 1]
  const nextCursor = rows[limit] && last ? encodeCursor(last.createdAt, last.id) : null
  return { items, nextCursor }
}

export async function loadMemberDashboardRows(
  db: DbHandle,
  opts: {
    orgId: string
    billingAccountId: string
    window: { from: Date; to: Date }
  }
) {
  const members = await db`
    select m.user_id, m.role, m.status, m.created_at, u.email
    from memberships m
    left join users u on u.id = m.user_id
    where m.org_id = ${opts.orgId} and m.status = 'active'
    order by m.role desc, m.created_at asc
  `

  const out = []
  for (const m of members) {
    const uid = String(m.user_id)
    const usage = await db`
      select coalesce(sum(credits), 0)::int as credits
      from usage_daily
      where org_id = ${opts.orgId}
        and user_id = ${uid}
        and day >= ${opts.window.from}
        and day < ${opts.window.to}
    `
    const last = await db`
      select max(created_at) as last_at
      from credit_transactions
      where billing_account_id = ${opts.billingAccountId}
        and user_id = ${uid}
    `
    const lastAt = last[0]?.last_at
    out.push({
      userId: uid,
      email: (m.email as string | null) ?? null,
      role: String(m.role),
      status: String(m.status),
      creditsUsed: Number(usage[0]?.credits ?? 0),
      lastActive: lastAt instanceof Date ? lastAt.toISOString() : null,
      createdAt: (m.created_at as Date).toISOString(),
    })
  }
  return out
}
