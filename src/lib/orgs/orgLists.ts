/**
 * Owner-facing org dashboard list queries (list-apis PR).
 * One SQL query per page — joins + aggregates in SQL, keyset paging.
 * Replaces the per-child / per-member query loops behind the dashboard routes.
 *
 * Money-safety: every value is a postgres.js parameter; sort/health/cursor
 * inputs are validated against whitelists by the route before reaching here.
 * Never select cost_usd / prices / provider / fal_* / payload columns.
 */
import type postgres from 'postgres'

import type { DbHandle } from '@/lib/db/wallet'

type Fragment = postgres.Fragment

const PAGE = 50

/* --------------------------------------------------------------------------
 * Sort cursor codec.
 * ponytail: lib/analytics/cursor's decodeCursor hard-requires Date.parse(at),
 * which rejects non-date sort values (names, counts). Same opaque base64url
 * `value<TAB>id` wire style, but the sort value rides as JSON (which escapes
 * tabs, so the separator is unambiguous). Upgrade path: widen the analytics
 * codec to accept string|number sort values and delete this.
 * ------------------------------------------------------------------------ */
export type SortCursor = { value: string | number; id: string }

export function encodeSortCursor(value: string | number, id: string): string {
  return Buffer.from(`${JSON.stringify(value)}\t${id}`, 'utf8').toString('base64url')
}

export function decodeSortCursor(raw: string | null): SortCursor | null {
  if (!raw) return null
  try {
    const text = Buffer.from(raw, 'base64url').toString('utf8')
    const cut = text.lastIndexOf('\t')
    if (cut <= 0) return null
    const value = JSON.parse(text.slice(0, cut)) as unknown
    const id = text.slice(cut + 1)
    if ((typeof value !== 'string' && typeof value !== 'number') || !id) return null
    return { value, id }
  } catch {
    return null
  }
}

/** Cursor value must match the sort column's type (date string for lastActive). */
export function cursorValueValid(sort: string, cursor: SortCursor): boolean {
  switch (sort) {
    case 'name':
    case 'email':
      return typeof cursor.value === 'string'
    case 'lastActive':
      return typeof cursor.value === 'string' && !Number.isNaN(Date.parse(cursor.value))
    default:
      return typeof cursor.value === 'number' && Number.isFinite(cursor.value)
  }
}

/** `limit` param: default 50, 1..50 — null means the client sent garbage (400). */
export function parseLimit(raw: string | null): number | null {
  if (raw == null || raw === '') return PAGE
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > PAGE) return null
  return n
}

/* --------------------------------------------------------------------------
 * GET /api/orgs/:publicId/organisations — super-org children, one SQL query.
 * ------------------------------------------------------------------------ */
export type ChildOrgListRow = {
  publicId: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
  memberCount: number
  /** remaining / (allocation+top_up+sponsored granted this period), flooredPct rules. */
  walletPct: number
  /** Debits minus refunds this billing period. */
  creditsUsed: number
  /** (debits - refunds over last 30 days) / 30, 2-decimal. */
  burnPerDay: number
  /** remaining / burnPerDay, integer floor; null when there is no burn. */
  daysLeft: number | null
  /** Absolute overdrawn sponsored amount (0 when sponsored >= 0). */
  owes: number
  /** Any debit in the last 30 days. */
  active: boolean
}

export const CHILD_ORG_SORTS = [
  'name',
  'members',
  'walletPct',
  'used',
  'burn',
  'daysLeft',
  'owes',
  'active',
] as const
export type ChildOrgSort = (typeof CHILD_ORG_SORTS)[number]

export const CHILD_ORG_HEALTHS = ['active', 'inactive30', 'low', 'overdrawn'] as const
export type ChildOrgHealth = (typeof CHILD_ORG_HEALTHS)[number]

/** daysLeft sort sentinel: no-burn rows sort last on asc without NULL keyset pain. */
const NO_BURN_SORT = 2147483647

export async function listChildOrganisations(
  db: DbHandle,
  opts: {
    superOrgId: string
    q: string | null
    sort: ChildOrgSort
    cursor: SortCursor | null
    limit: number
    health: ChildOrgHealth | null
  }
): Promise<{ items: ChildOrgListRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit, 1), PAGE)

  const remaining: Fragment = db`(b.allocation_balance + b.top_up_balance + b.sponsored_balance)`
  // flooredPct(remaining, granted): 0 unless both granted > 0 and remaining > 0.
  const walletPct: Fragment = db`case
    when agg.granted_period > 0 and ${remaining} > 0
    then least(100, floor(${remaining}::numeric / agg.granted_period * 10000) / 100)
    else 0 end`
  const daysLeft: Fragment = db`case
    when agg.burn_30d > 0 then (greatest(${remaining}, 0))::bigint * 30 / agg.burn_30d
    else null end`
  const daysLeftSort: Fragment = db`coalesce(${daysLeft}, ${NO_BURN_SORT})`
  const owes: Fragment = db`case when b.sponsored_balance < 0 then -b.sponsored_balance else 0 end`
  const activeSort: Fragment = db`case when agg.active_30d then 1 else 0 end`

  // Fixed natural direction per sort key (name asc is the default sort).
  let sortExpr: Fragment
  let desc: boolean
  switch (opts.sort) {
    case 'members':
      sortExpr = db`mc.n`
      desc = true
      break
    case 'walletPct':
      sortExpr = walletPct
      desc = false
      break
    case 'used':
      sortExpr = db`agg.used_period`
      desc = true
      break
    case 'burn':
      sortExpr = db`agg.burn_30d`
      desc = true
      break
    case 'daysLeft':
      sortExpr = daysLeftSort
      desc = false
      break
    case 'owes':
      sortExpr = owes
      desc = true
      break
    case 'active':
      sortExpr = activeSort
      desc = true
      break
    default:
      sortExpr = db`lower(o.name)`
      desc = false
      break
  }
  const dir: Fragment = desc ? db`desc` : db`asc`

  const health: Fragment =
    opts.health === 'active'
      ? db`and agg.active_30d`
      : opts.health === 'inactive30'
        ? db`and not agg.active_30d`
        : opts.health === 'low'
          ? db`and ${walletPct} < 10`
          : opts.health === 'overdrawn'
            ? db`and b.sponsored_balance < 0`
            : db``

  const keyset: Fragment = opts.cursor
    ? desc
      ? db`and (${sortExpr}, o.id) < (${opts.cursor.value}, ${opts.cursor.id}::uuid)`
      : db`and (${sortExpr}, o.id) > (${opts.cursor.value}, ${opts.cursor.id}::uuid)`
    : db``

  const q: Fragment = opts.q
    ? db`and position(lower(${opts.q}) in lower(o.name)) > 0`
    : db``

  const rows = await db`
    select
      o.id, o.public_id, o.name,
      ow.owner_name, ow.owner_email,
      mc.n as member_count,
      ${walletPct} as wallet_pct,
      agg.used_period as credits_used,
      agg.burn_30d,
      ${daysLeft} as days_left,
      ${owes} as owes,
      agg.active_30d as active
    from organizations o
    join billing_accounts b on b.owner_org_id = o.id
    cross join lateral (
      -- usagePeriodWindow, in SQL: prepaid = calendar month UTC;
      -- else open cycle implied by current_period_end + billing_cycle.
      select
        case
          when b.access_mode = 'prepaid'
            then date_trunc('month', now() at time zone 'utc') at time zone 'utc'
          when b.current_period_end is not null
            then b.current_period_end - make_interval(months => case when b.billing_cycle = 'annual' then 12 else 1 end)
          else now() - interval '30 days'
        end as period_from,
        case
          when b.access_mode = 'prepaid'
            then (date_trunc('month', now() at time zone 'utc') at time zone 'utc') + interval '1 month'
          when b.current_period_end is not null then least(now(), b.current_period_end)
          else now()
        end as period_to
    ) w
    left join lateral (
      select u.display_name as owner_name, u.email as owner_email
      from memberships m
      left join users u on u.id = m.user_id
      where m.org_id = o.id and m.status = 'active' and m.role = 'owner'
      order by m.created_at asc
      limit 1
    ) ow on true
    left join lateral (
      select count(*)::int as n
      from memberships m
      where m.org_id = o.id and m.status = 'active'
    ) mc on true
    left join lateral (
      select
        coalesce(sum(case when ct.type = 'debit' then ct.amount when ct.type = 'refund' then -ct.amount end)
          filter (where ct.created_at >= w.period_from and ct.created_at < w.period_to), 0)::int as used_period,
        coalesce(sum(case when ct.type = 'debit' then ct.amount when ct.type = 'refund' then -ct.amount end)
          filter (where ct.created_at >= now() - interval '30 days'), 0)::int as burn_30d,
        coalesce(sum(ct.amount) filter (
          where ct.created_at >= w.period_from and ct.created_at < w.period_to
            and ((ct.type = 'grant' and ct.bucket in ('allocation', 'top_up'))
              or (ct.type in ('transfer_in', 'debt_recovery') and ct.bucket = 'sponsored'))
        ), 0)::int as granted_period,
        coalesce(bool_or(ct.type = 'debit' and ct.created_at >= now() - interval '30 days'), false) as active_30d
      from credit_transactions ct
      where ct.billing_account_id = b.id
    ) agg on true
    where o.parent_id = ${opts.superOrgId}
      ${q}
      ${health}
      ${keyset}
    order by ${sortExpr} ${dir}, o.id ${dir}
    limit ${limit + 1}
  `

  const page = rows.slice(0, limit)
  const items: ChildOrgListRow[] = page.map((r) => ({
    publicId: String(r.public_id),
    name: String(r.name),
    ownerName: r.owner_name == null ? null : String(r.owner_name),
    ownerEmail: r.owner_email == null ? null : String(r.owner_email),
    memberCount: Number(r.member_count) || 0,
    walletPct: Number(r.wallet_pct) || 0,
    creditsUsed: Number(r.credits_used) || 0,
    burnPerDay: Math.round(((Number(r.burn_30d) || 0) / 30) * 100) / 100,
    daysLeft: r.days_left == null ? null : Number(r.days_left),
    owes: Number(r.owes) || 0,
    active: r.active === true,
  }))

  const last = page[page.length - 1]
  let nextCursor: string | null = null
  if (rows[limit] && last) {
    let value: string | number
    switch (opts.sort) {
      case 'members':
        value = Number(last.member_count) || 0
        break
      case 'walletPct':
        value = Number(last.wallet_pct) || 0
        break
      case 'used':
        value = Number(last.credits_used) || 0
        break
      case 'burn':
        value = Number(last.burn_30d) || 0
        break
      case 'daysLeft':
        value = last.days_left == null ? NO_BURN_SORT : Number(last.days_left)
        break
      case 'owes':
        value = Number(last.owes) || 0
        break
      case 'active':
        value = last.active === true ? 1 : 0
        break
      default:
        value = String(last.name).toLowerCase()
        break
    }
    nextCursor = encodeSortCursor(value, String(last.id))
  }
  return { items, nextCursor }
}

/* --------------------------------------------------------------------------
 * GET /api/orgs/:publicId/members — org members, one SQL query.
 * ------------------------------------------------------------------------ */
export type OrgMemberListRow = {
  userId: string
  name: string | null
  email: string | null
  role: string
  status: string
  /** Debits minus refunds this billing period. */
  creditsUsed: number
  /** Latest credit_transactions row on this wallet (same source as the dashboard). */
  lastActive: string | null
}

export const ORG_MEMBER_SORTS = ['name', 'email', 'role', 'used', 'lastActive'] as const
export type OrgMemberSort = (typeof ORG_MEMBER_SORTS)[number]

/** Never-active members sort last on lastActive desc. */
const NO_ACTIVITY_EPOCH = '1970-01-01T00:00:00.000Z'

export async function listOrgMembers(
  db: DbHandle,
  opts: {
    orgId: string
    billingAccountId: string | null
    window: { from: Date; to: Date }
    q: string | null
    sort: OrgMemberSort
    cursor: SortCursor | null
    limit: number
  }
): Promise<{ items: OrgMemberListRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit, 1), PAGE)

  const roleRank: Fragment = db`case m.role when 'owner' then 0 when 'admin' then 1 else 2 end`

  let sortExpr: Fragment
  let desc: boolean
  switch (opts.sort) {
    case 'email':
      sortExpr = db`lower(coalesce(u.email, ''))`
      desc = false
      break
    case 'role':
      sortExpr = roleRank
      desc = false
      break
    case 'used':
      sortExpr = db`coalesce(agg.used_period, 0)`
      desc = true
      break
    case 'lastActive':
      sortExpr = db`coalesce(agg.last_active, ${NO_ACTIVITY_EPOCH}::timestamptz)`
      desc = true
      break
    default:
      sortExpr = db`lower(coalesce(u.display_name, ''))`
      desc = false
      break
  }
  const dir: Fragment = desc ? db`desc` : db`asc`

  // Keyset tiebreak: membership user_id (unique within the org).
  const cursor = opts.cursor
  const keyset: Fragment = cursor
    ? desc
      ? opts.sort === 'lastActive'
        ? db`and (${sortExpr}, m.user_id) < (${new Date(String(cursor.value))}, ${cursor.id})`
        : db`and (${sortExpr}, m.user_id) < (${cursor.value}, ${cursor.id})`
      : db`and (${sortExpr}, m.user_id) > (${cursor.value}, ${cursor.id})`
    : db``

  const q: Fragment = opts.q
    ? db`and (
        position(lower(${opts.q}) in lower(coalesce(u.display_name, ''))) > 0
        or position(lower(${opts.q}) in lower(coalesce(u.email, ''))) > 0
      )`
    : db``

  const rows = await db`
    select
      m.user_id, m.role, m.status,
      u.display_name as name, u.email,
      coalesce(agg.used_period, 0)::int as credits_used,
      agg.last_active
    from memberships m
    left join users u on u.id = m.user_id
    left join lateral (
      select
        sum(case when ct.type = 'debit' then ct.amount when ct.type = 'refund' then -ct.amount end)
          filter (where ct.type in ('debit', 'refund')
            and ct.created_at >= ${opts.window.from}
            and ct.created_at < ${opts.window.to}) as used_period,
        max(ct.created_at) as last_active
      from credit_transactions ct
      where ct.billing_account_id = ${opts.billingAccountId}
        and ct.user_id = m.user_id
    ) agg on true
    where m.org_id = ${opts.orgId}
      and m.status = 'active'
      ${q}
      ${keyset}
    order by ${sortExpr} ${dir}, m.user_id ${dir}
    limit ${limit + 1}
  `

  const page = rows.slice(0, limit)
  const items: OrgMemberListRow[] = page.map((r) => ({
    userId: String(r.user_id),
    name: r.name == null ? null : String(r.name),
    email: r.email == null ? null : String(r.email),
    role: String(r.role),
    status: String(r.status),
    creditsUsed: Number(r.credits_used) || 0,
    lastActive: r.last_active instanceof Date ? r.last_active.toISOString() : null,
  }))

  const last = page[page.length - 1]
  let nextCursor: string | null = null
  if (rows[limit] && last) {
    let value: string | number
    switch (opts.sort) {
      case 'email':
        value = (last.email == null ? '' : String(last.email)).toLowerCase()
        break
      case 'role':
        value = last.role === 'owner' ? 0 : last.role === 'admin' ? 1 : 2
        break
      case 'used':
        value = Number(last.credits_used) || 0
        break
      case 'lastActive':
        value = last.last_active instanceof Date ? last.last_active.toISOString() : NO_ACTIVITY_EPOCH
        break
      default:
        value = (last.name == null ? '' : String(last.name)).toLowerCase()
        break
    }
    nextCursor = encodeSortCursor(value, String(last.user_id))
  }
  return { items, nextCursor }
}
