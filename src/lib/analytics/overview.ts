/**
 * Org / super-org overview for GET /api/orgs/:publicId/overview.
 * Percentages reuse billingSummary/credits helpers; child aggregates reuse
 * orgLists. One SQL statement per concern — no per-child loops.
 * Card-omission: fields with no data are left out; the client renders only
 * what exists.
 */
import { sponsoredRemainingPct } from '@/lib/api/billingSummary'
import type { OrgRow } from '@/lib/orgs/authorize'
import { getBillingByOrgId, type BillingAccountData, type DbHandle } from '@/lib/db/wallet'
import { listChildOrganisations } from '@/lib/orgs/orgLists'
import { usagePeriodWindow } from '@/lib/orgs/periodWindow'
import { additionalRemainingPct, remainingPct } from '@/types/credits'

export type OverviewRole = 'owner' | 'inherited_read' | 'platform_admin'

const DAY_MS = 24 * 60 * 60 * 1000

function dayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function isoDay(d: unknown): string {
  const date = d instanceof Date ? d : new Date(String(d))
  return date.toISOString().slice(0, 10)
}

export async function loadOrgOverview(
  db: DbHandle,
  opts: { org: OrgRow; role: OverviewRole; now?: Date }
): Promise<Record<string, unknown>> {
  const now = opts.now ?? new Date()
  const org = opts.org
  const billing = await getBillingByOrgId(db, org.id)

  const body: Record<string, unknown> = {
    publicId: org.publicId,
    name: org.name,
    kind: org.kind,
    badge: 'independent',
  }
  if (org.parentId) {
    const parent = await db`
      select name from organizations where id = ${org.parentId}
    `
    if (parent[0]?.name) body.badge = { partOf: String(parent[0].name) }
  }

  const memberRows = await db`
    select count(*)::int as n
    from memberships
    where org_id = ${org.id} and status = 'active'
  `
  body.memberCount = Number(memberRows[0]?.n ?? 0)

  if (billing) {
    await fillWalletCards(db, body, billing, now)
  }
  if (org.kind === 'super_org' && billing) {
    await fillSuperOrgCards(db, body, opts.role, org, billing, now)
  }
  return body
}

async function fillWalletCards(
  db: DbHandle,
  body: Record<string, unknown>,
  billing: BillingAccountData,
  now: Date
): Promise<void> {
  if (billing.creditsIncluded > 0 || billing.allocationGrantedTotal > 0) {
    body.planPct = remainingPct(
      billing.creditsIncluded,
      billing.allocationBalance,
      billing.allocationGrantedTotal
    )
  }
  if (billing.topUpBalance > 0 || billing.topUpReference > 0) {
    body.additionalPct = additionalRemainingPct(billing.topUpBalance, billing.topUpReference)
  }
  if (billing.sponsoredBalance > 0 || billing.sponsoredReference > 0) {
    body.sponsoredPct = sponsoredRemainingPct(billing.sponsoredBalance, billing.sponsoredReference)
  }

  const window = usagePeriodWindow({
    accessMode: billing.accessMode,
    billingCycle: billing.billingCycle,
    currentPeriodEnd: billing.currentPeriodEnd,
    now,
  })
  const prevFrom = new Date(window.from.getTime() - (window.to.getTime() - window.from.getTime()))

  // One SQL: used this period + previous equal period (net of refunds).
  const usedRows = await db`
    select
      coalesce(sum(case when type = 'debit' then amount when type = 'refund' then -amount end)
        filter (where created_at >= ${window.from} and created_at < ${window.to}), 0)::int as current,
      coalesce(sum(case when type = 'debit' then amount when type = 'refund' then -amount end)
        filter (where created_at >= ${prevFrom} and created_at < ${window.from}), 0)::int as previous
    from credit_transactions
    where billing_account_id = ${billing.id}
      and type in ('debit', 'refund')
  `
  const used = Number(usedRows[0]?.current ?? 0)
  body.usedThisPeriod = { credits: used, delta: used - Number(usedRows[0]?.previous ?? 0) }

  // One SQL: top members by credits this period (bars data).
  const top = await db`
    select m.user_id,
      coalesce(nullif(u.display_name, ''), nullif(u.email, ''), m.user_id) as label,
      sum(case when ct.type = 'debit' then ct.amount when ct.type = 'refund' then -ct.amount end)::int as credits
    from memberships m
    left join users u on u.id = m.user_id
    join credit_transactions ct
      on ct.billing_account_id = ${billing.id}
      and ct.user_id = m.user_id
      and ct.type in ('debit', 'refund')
      and ct.created_at >= ${window.from}
      and ct.created_at < ${window.to}
    where m.org_id = ${billing.ownerOrgId} and m.status = 'active'
    group by m.user_id, u.display_name, u.email
    having sum(case when ct.type = 'debit' then ct.amount when ct.type = 'refund' then -ct.amount end) > 0
    order by credits desc, m.user_id asc
    limit 10
  `
  if (top.length > 0) {
    body.top10Members = top.map((r) => ({
      userId: String(r.user_id),
      label: String(r.label),
      credits: Number(r.credits) || 0,
    }))
  }

  // One SQL: per-day credits for the last 30 UTC days (zero-filled series).
  const trendTo = dayUtc(now)
  const trendFrom = new Date(trendTo.getTime() - 29 * DAY_MS)
  const days = await db`
    with days as (
      select generate_series(${trendFrom}::timestamptz, ${trendTo}::timestamptz, interval '1 day') as d
    ),
    used as (
      select date_trunc('day', created_at at time zone 'utc') at time zone 'utc' as d,
        sum(case when type = 'debit' then amount when type = 'refund' then -amount end)::int as credits
      from credit_transactions
      where billing_account_id = ${billing.id}
        and type in ('debit', 'refund')
        and created_at >= ${trendFrom}
      group by 1
    )
    select days.d, coalesce(used.credits, 0)::int as credits
    from days left join used on used.d = days.d
    order by days.d
  `
  const series = days.map((r) => ({ day: isoDay(r.d), credits: Number(r.credits) || 0 }))
  if (series.some((p) => p.credits !== 0)) body.usageLast30Days = series
}

async function fillSuperOrgCards(
  db: DbHandle,
  body: Record<string, unknown>,
  role: OverviewRole,
  org: OrgRow,
  billing: BillingAccountData,
  now: Date
): Promise<void> {
  const trendTo = dayUtc(now)
  const trendFrom = new Date(trendTo.getTime() - 29 * DAY_MS)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))

  // One SQL: children count, active-in-30d count, owed (negative sponsored sums).
  const stats = await db`
    select
      count(*)::int as orgs,
      count(*) filter (where act.billing_account_id is not null)::int as active,
      coalesce(sum(case when b.sponsored_balance < 0 then -b.sponsored_balance else 0 end), 0)::int as owed
    from organizations o
    join billing_accounts b on b.owner_org_id = o.id
    left join (
      select distinct billing_account_id
      from credit_transactions
      where type = 'debit' and created_at >= ${trendFrom}
    ) act on act.billing_account_id = b.id
    where o.parent_id = ${org.id}
  `
  body.organisationsCount = Number(stats[0]?.orgs ?? 0)
  body.activeOrgs30d = Number(stats[0]?.active ?? 0)
  body.owed = Number(stats[0]?.owed ?? 0)

  // One SQL: sent to children this calendar month.
  const sentRows = await db`
    select coalesce(sum(amount), 0)::int as sent
    from credit_transactions
    where billing_account_id = ${billing.id}
      and type = 'transfer_out'
      and reason = 'org.transfer'
      and created_at >= ${monthStart}
  `
  body.sentThisMonth = Number(sentRows[0]?.sent ?? 0)

  if (billing.topUpBalance > 0 || billing.topUpReference > 0) {
    body.poolPct = additionalRemainingPct(billing.topUpBalance, billing.topUpReference)
  }
  // Exact credits: owner roles only — never inherited_read.
  if (role === 'owner' || role === 'platform_admin') {
    body.availableToSend = billing.topUpBalance
  }

  // Top 5 children by usage — reuses the orgLists aggregate query.
  const top5 = await listChildOrganisations(db, {
    superOrgId: org.id,
    q: null,
    sort: 'used',
    cursor: null,
    limit: 5,
    health: null,
  })
  const top5Items = top5.items
    .filter((i) => i.creditsUsed > 0)
    .map((i) => ({ publicId: i.publicId, name: i.name, credits: i.creditsUsed }))
  if (top5Items.length > 0) body.top5Orgs = top5Items

  // One SQL: sent vs used per month for the last 6 months (UTC).
  const months = await db`
    with months as (
      select generate_series(${sixMonthsAgo}::timestamptz, ${monthStart}::timestamptz, interval '1 month') as m
    ),
    sent as (
      select date_trunc('month', created_at at time zone 'utc') at time zone 'utc' as m,
        sum(amount)::int as v
      from credit_transactions
      where billing_account_id = ${billing.id}
        and type = 'transfer_out'
        and reason = 'org.transfer'
        and created_at >= ${sixMonthsAgo}
      group by 1
    ),
    used as (
      select date_trunc('month', ct.created_at at time zone 'utc') at time zone 'utc' as m,
        sum(case when ct.type = 'debit' then ct.amount when ct.type = 'refund' then -ct.amount end)::int as v
      from credit_transactions ct
      join billing_accounts b on b.id = ct.billing_account_id
      join organizations o on o.id = b.owner_org_id
      where o.parent_id = ${org.id}
        and ct.type in ('debit', 'refund')
        and ct.created_at >= ${sixMonthsAgo}
      group by 1
    )
    select months.m, coalesce(sent.v, 0)::int as sent, coalesce(used.v, 0)::int as used
    from months
    left join sent on sent.m = months.m
    left join used on used.m = months.m
    order by months.m
  `
  const monthSeries = months.map((r) => ({
    month: isoDay(r.m).slice(0, 7),
    sent: Number(r.sent) || 0,
    used: Number(r.used) || 0,
  }))
  if (monthSeries.some((p) => p.sent !== 0 || p.used !== 0)) {
    body.sentVsUsedByMonth = monthSeries
  }

  // One SQL: per-day usage across all children for the last 30 UTC days.
  const trend = await db`
    with days as (
      select generate_series(${trendFrom}::timestamptz, ${trendTo}::timestamptz, interval '1 day') as d
    ),
    used as (
      select date_trunc('day', ct.created_at at time zone 'utc') at time zone 'utc' as d,
        sum(case when ct.type = 'debit' then ct.amount when ct.type = 'refund' then -ct.amount end)::int as credits
      from credit_transactions ct
      join billing_accounts b on b.id = ct.billing_account_id
      join organizations o on o.id = b.owner_org_id
      where o.parent_id = ${org.id}
        and ct.type in ('debit', 'refund')
        and ct.created_at >= ${trendFrom}
      group by 1
    )
    select days.d, coalesce(used.credits, 0)::int as credits
    from days left join used on used.d = days.d
    order by days.d
  `
  const trendSeries = trend.map((r) => ({ day: isoDay(r.d), credits: Number(r.credits) || 0 }))
  if (trendSeries.some((p) => p.credits !== 0)) body.usageTrend = trendSeries
}
