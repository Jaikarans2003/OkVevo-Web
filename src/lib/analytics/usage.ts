/**
 * Usage aggregation for the org dashboard and billing views.
 * Reads credit_transactions directly — usage_daily buckets in UTC, so
 * tz-aware buckets need the raw rows. Credits and requests mirror the view:
 * debits minus refunds; requests = count of debit rows.
 * SQL groups by raw keys. Model series are returned under the customer label
 * (raw ids never leave this module). A model filter accepts that label or the raw id.
 */
import { csvCell, csvLine } from '@/lib/analytics/csv'
import { jobTypeCaseSql } from '@/lib/analytics/jobTypeSql'
import type { DbHandle } from '@/lib/db/wallet'
import { customerModel, type CustomerJobType } from '@/lib/gateway/modelCatalog'

export type UsageBucket = 'day' | 'week' | 'month'
export type UsageGroupBy = 'model' | 'job_type' | 'member' | 'org'

export type UsageParams = {
  /** YYYY-MM-DD local in tz; null = 29 days before `to`. */
  from: string | null
  /** YYYY-MM-DD local in tz, inclusive; null = today in tz. */
  to: string | null
  tz: string
  bucket: UsageBucket
  groupBy: UsageGroupBy
  member: string | null
  model: string | null
  jobType: CustomerJobType | null
  csv: boolean
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const JOB_TYPES: Record<string, CustomerJobType> = {
  chat: 'Chat',
  search: 'Search',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
}

function validLocalDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function parseUsageParams(
  searchParams: URLSearchParams
): { ok: true; params: UsageParams } | { ok: false; code: string } {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if ((from && !validLocalDate(from)) || (to && !validLocalDate(to))) {
    return { ok: false, code: 'invalid_range' }
  }
  if (from && to && to < from) return { ok: false, code: 'invalid_range' }

  const bucket = searchParams.get('bucket') || 'day'
  if (bucket !== 'day' && bucket !== 'week' && bucket !== 'month') {
    return { ok: false, code: 'invalid_bucket' }
  }
  const groupBy = searchParams.get('group_by') || 'model'
  if (groupBy !== 'model' && groupBy !== 'job_type' && groupBy !== 'member' && groupBy !== 'org') {
    return { ok: false, code: 'invalid_group_by' }
  }
  const member = searchParams.get('member')?.trim() || null
  if (member && member.length > 128) return { ok: false, code: 'invalid_member' }
  const model = searchParams.get('model')?.trim() || null
  if (model && model.length > 200) return { ok: false, code: 'invalid_model' }
  const jobTypeRaw = searchParams.get('job_type')?.trim().toLowerCase()
  let jobType: CustomerJobType | null = null
  if (jobTypeRaw) {
    jobType = JOB_TYPES[jobTypeRaw] ?? null
    if (!jobType) return { ok: false, code: 'invalid_job_type' }
  }
  return {
    ok: true,
    params: {
      from,
      to,
      tz: searchParams.get('tz')?.trim() || 'UTC',
      bucket,
      groupBy,
      member,
      model,
      jobType,
      csv: searchParams.get('format') === 'csv',
    },
  }
}

export type UsageSeriesRow = { bucket: string; key: string; credits: number; requests: number }

export type UsageResult = {
  tz: string
  bucket: UsageBucket
  groupBy: UsageGroupBy
  from: string
  to: string
  series: UsageSeriesRow[]
  labels: Record<string, string>
  totals: { credits: number; requests: number; activeMembers?: number }
  previous: { credits: number; requests: number }
  top: { key: string; credits: number }[]
}

export type UsageScope =
  | { kind: 'org'; orgId: string; includeChildren: boolean }
  | { kind: 'wallet'; billingAccountId: string }

export async function queryUsage(
  db: DbHandle,
  params: UsageParams,
  scope: UsageScope,
  /** Final user_id filter (member-forced by the route, or an owner's member pick). */
  userId: string | null
): Promise<{ ok: true; result: UsageResult } | { ok: false; code: 'invalid_tz' }> {
  const tz = params.tz
  const tzRows = await db`select 1 from pg_timezone_names where name = ${tz}`
  if (!tzRows[0]) return { ok: false, code: 'invalid_tz' }

  // Local midnights in tz -> UTC instants. `to` is an inclusive local date.
  const boundRows = await db`
    with b as (
      select
        coalesce(${params.from}::date, (now() at time zone ${tz})::date - 29) as from_date,
        coalesce(${params.to}::date, (now() at time zone ${tz})::date) as to_date
    )
    select
      from_date::text as from_date,
      to_date::text as to_date,
      (from_date::timestamp at time zone ${tz}) as from_utc,
      ((to_date + 1)::timestamp at time zone ${tz}) as to_utc
    from b
  `
  const bounds = boundRows[0] as Record<string, unknown>
  const fromDate = String(bounds.from_date)
  const toDate = String(bounds.to_date)
  const fromUtc = bounds.from_utc as Date
  const toUtc = bounds.to_utc as Date
  // Immediately preceding period of equal length, fetched in the same query.
  const prevFromUtc = new Date(fromUtc.getTime() - (toUtc.getTime() - fromUtc.getTime()))

  const keyFrag =
    params.groupBy === 'model'
      ? db`coalesce(nullif(requested_model, ''), model, '')`
      : params.groupBy === 'job_type'
        ? jobTypeCaseSql(db, 'ledger')
        : params.groupBy === 'member'
          ? db`coalesce(user_id, '')`
          : db`coalesce(org_id::text, '')`

  const scopeFrag =
    scope.kind === 'wallet'
      ? db`billing_account_id = ${scope.billingAccountId}`
      : scope.includeChildren
        ? db`(org_id = ${scope.orgId} or super_org_id = ${scope.orgId} or org_id in (
             select id from organizations where parent_id = ${scope.orgId}
           ))`
        : db`(org_id = ${scope.orgId} or super_org_id = ${scope.orgId})`

  const fmt = params.bucket === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'

  const rows = await db`
    select
      to_char(date_trunc(${params.bucket}, created_at at time zone ${tz}), ${fmt}) as bucket,
      ${keyFrag} as key,
      coalesce(nullif(requested_model, ''), model, '') as model_key,
      (count(*) filter (where type = 'debit'))::int as requests,
      (sum(case type when 'debit' then amount when 'refund' then -amount else 0 end))::int as credits,
      (count(*) filter (where type = 'debit' and created_at >= ${fromUtc}))::int as cur_requests,
      sum(case when created_at >= ${fromUtc}
           then case type when 'debit' then amount when 'refund' then -amount else 0 end
           else 0 end)::int as cur_credits
    from credit_transactions
    where type in ('debit', 'refund')
      and created_at >= ${prevFromUtc}
      and created_at < ${toUtc}
      and ${scopeFrag}
      ${userId ? db`and user_id = ${userId}` : db``}
      ${params.jobType ? db`and ${jobTypeCaseSql(db, 'ledger')} = ${params.jobType}` : db``}
    group by 1, 2, 3
    order by 1 asc, 2 asc
  `

  const seriesAcc = new Map<string, UsageSeriesRow>()
  const labels: Record<string, string> = {}
  let credits = 0
  let requests = 0
  let prevCredits = 0
  let prevRequests = 0
  for (const row of rows) {
    const r = row as Record<string, unknown>
    const rawModel = String(r.model_key ?? '')
    const modelLabel = customerModel({ requestedModel: rawModel || null }).label
    // Filter accepts the label the customer saw, or the raw id (older links).
    if (params.model && params.model !== rawModel && params.model !== modelLabel) continue
    const curCredits = Number(r.cur_credits) || 0
    const curRequests = Number(r.cur_requests) || 0
    prevCredits += (Number(r.credits) || 0) - curCredits
    prevRequests += (Number(r.requests) || 0) - curRequests
    credits += curCredits
    requests += curRequests
    if (curCredits === 0 && curRequests === 0) continue
    const rawKey = String(r.key ?? '')
    const key = params.groupBy === 'model' ? modelLabel : rawKey
    const id = `${String(r.bucket)}\0${key}`
    const existing = seriesAcc.get(id)
    if (existing) {
      existing.credits += curCredits
      existing.requests += curRequests
    } else {
      seriesAcc.set(id, { bucket: String(r.bucket), key, credits: curCredits, requests: curRequests })
    }
    if (params.groupBy === 'model' || params.groupBy === 'job_type') labels[key] = key
  }
  const series = [...seriesAcc.values()]

  // Member/org labels live in the database — one lookup for the page's keys, no N+1.
  if (params.groupBy === 'member' && series.length > 0) {
    const ids = [...new Set(series.map((s) => s.key))]
    const users = await db`
      select id, coalesce(nullif(display_name, ''), nullif(email, ''), id) as label
      from users where id in ${db(ids)}
    `
    for (const u of users) labels[String(u.id)] = String(u.label)
  } else if (params.groupBy === 'org' && series.length > 0) {
    const ids = [...new Set(series.map((s) => s.key))]
    const orgs = await db`
      select id::text as id, name from organizations where id in ${db(ids)}
    `
    for (const o of orgs) labels[String(o.id)] = String(o.name)
  }

  // Top groups by credits; raw keys that share a label merge into one entry.
  const merged = new Map<string, number>()
  for (const s of series) {
    const label = labels[s.key] ?? s.key
    merged.set(label, (merged.get(label) ?? 0) + s.credits)
  }
  const top = [...merged.entries()]
    .map(([key, value]) => ({ key, credits: value }))
    .sort((a, b) => b.credits - a.credits || a.key.localeCompare(b.key))
    .slice(0, 10)

  const totals: UsageResult['totals'] = { credits, requests }
  // ponytail: activeMembers only for group_by=member (distinct series keys);
  // upgrade path for other groupings is a count(distinct user_id) query.
  if (params.groupBy === 'member') {
    totals.activeMembers = new Set(series.map((s) => s.key).filter(Boolean)).size
  }

  return {
    ok: true,
    result: {
      tz,
      bucket: params.bucket,
      groupBy: params.groupBy,
      from: fromDate,
      to: toDate,
      series,
      labels,
      totals,
      previous: { credits: prevCredits, requests: prevRequests },
      top,
    },
  }
}

export function usageCsv(result: UsageResult): string {
  const lines = [
    csvLine(['Bucket', 'Key', 'Label', 'Credits', 'Requests'].map((c) => csvCell(c))),
    ...result.series.map((row) =>
      csvLine([
        csvCell(row.bucket),
        csvCell(row.key),
        csvCell(result.labels[row.key] ?? ''),
        csvCell(row.credits, 'number'),
        csvCell(row.requests, 'number'),
      ])
    ),
  ]
  return lines.join('')
}
