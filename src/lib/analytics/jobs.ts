import { decodeCursor, encodeCursor } from '@/lib/analytics/cursor'
import { csvCell, csvLine } from '@/lib/analytics/csv'
import { customerLabelSql, jobTypeCaseSql } from '@/lib/analytics/jobTypeSql'
import { notAliasJob } from '@/lib/analytics/jobScope'
import { releaseReasonWording } from '@/lib/analytics/releaseReasonCopy'
import type { DbHandle } from '@/lib/db/wallet'
import { customerModel, type CustomerJobType } from '@/lib/gateway/modelCatalog'

export type JobRow = {
  id: string
  createdAt: string
  memberUserId: string
  modelLabel: string
  jobType: string
  status: string
  credits: number
  releaseReason: string | null
}

const PAGE = 50

/** Job lifecycle statuses (reserve → queue/dispatch → settle/release). */
const JOB_STATUSES = ['reserved', 'queued', 'dispatching', 'submitted', 'settled', 'released']

const JOB_TYPES: Record<string, CustomerJobType> = {
  chat: 'Chat',
  search: 'Search',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
}

export type JobParams = {
  from: Date | null
  to: Date | null
  member: string | null
  model: string | null
  jobType: CustomerJobType | null
  status: string | null
  cursor: string | null
  limit: number
  csv: boolean
}

export function parseJobParams(
  searchParams: URLSearchParams
): { ok: true; params: JobParams } | { ok: false; code: string } {
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')
  const from = fromRaw ? new Date(fromRaw) : null
  const to = toRaw ? new Date(toRaw) : null
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return { ok: false, code: 'invalid_range' }
  }
  if (from && to && to < from) return { ok: false, code: 'invalid_range' }
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
  const status = searchParams.get('status')?.trim().toLowerCase() || null
  if (status && !JOB_STATUSES.includes(status)) return { ok: false, code: 'invalid_status' }
  const limitRaw = searchParams.get('limit')
  const limit = limitRaw ? Number(limitRaw) : 50
  if (!Number.isInteger(limit) || limit < 1) return { ok: false, code: 'invalid_limit' }
  return {
    ok: true,
    params: {
      from,
      to,
      member,
      model,
      jobType,
      status,
      cursor: searchParams.get('cursor'),
      limit,
      csv: searchParams.get('format') === 'csv',
    },
  }
}

export type JobFilters = {
  /** Org scope (org jobs route). Exactly one of orgId / billingAccountId. */
  orgId?: string
  /** Wallet scope (billing jobs route). */
  billingAccountId?: string
  /** Final user_id filter (member-forced by the route, or an owner's member pick). */
  userId?: string | null
  from?: Date | null
  to?: Date | null
  model?: string | null
  jobType?: CustomerJobType | null
  status?: string | null
  limit?: number
  cursor?: string | null
}

/** Billed model for jobs whose requested_model was never stamped. One lookup for the page. */
async function billedModelsForJobs(db: DbHandle, ids: string[]) {
  const map = new Map<string, { model: string | null; requestedModel: string | null }>()
  if (ids.length === 0) return map
  const rows = await db`
    select distinct on (request_id) request_id, model, requested_model
    from credit_transactions
    where type = 'debit' and request_id in ${db(ids)}
    order by request_id, created_at desc
  `
  for (const row of rows) {
    map.set(String(row.request_id), {
      model: row.model == null ? null : String(row.model),
      requestedModel: row.requested_model == null ? null : String(row.requested_model),
    })
  }
  return map
}

/** Customer jobs page. The row is an explicit field list. */
export async function listOrgJobs(
  db: DbHandle,
  opts: JobFilters
): Promise<{ items: JobRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? PAGE, 1), PAGE)
  const cursor = decodeCursor(opts.cursor ?? null)
  if (!opts.billingAccountId && !opts.orgId) {
    throw new Error('listOrgJobs: orgId or billingAccountId required')
  }
  const scopeFrag = opts.billingAccountId
    ? db`billing_account_id = ${opts.billingAccountId}`
    : db`org_id = ${opts.orgId!}`
  const shownKey = db`coalesce(nullif(requested_model, ''), nullif(endpoint, ''), '')`
  const rows = await db`
    select id, created_at, user_id, requested_model, endpoint, provider, status,
           coalesce(settled_credits, estimated_credits, 0)::int as credits,
           release_reason
    from gateway_jobs
    where ${scopeFrag}
      and ${notAliasJob(db)}
      ${opts.userId ? db`and user_id = ${opts.userId}` : db``}
      ${opts.from ? db`and created_at >= ${opts.from}` : db``}
      ${opts.to ? db`and created_at < ${opts.to}` : db``}
      ${opts.model ? db`and (requested_model = ${opts.model} or endpoint = ${opts.model} or ${customerLabelSql(db, shownKey)} = ${opts.model})` : db``}
      ${opts.jobType ? db`and ${jobTypeCaseSql(db, 'jobs')} = ${opts.jobType}` : db``}
      ${opts.status ? db`and status = ${opts.status}` : db``}
      ${cursor ? db`and (created_at, id) < (${cursor.at}::timestamptz, ${cursor.id})` : db``}
    order by created_at desc, id desc
    limit ${limit + 1}
  `
  const page = rows.slice(0, limit)
  const billed = await billedModelsForJobs(db, page.map((row) => String(row.id)))
  const items: JobRow[] = page.map((row) => {
    const tx = billed.get(String(row.id))
    const requested =
      (row.requested_model as string | null) || tx?.requestedModel || null
    const billedModel =
      tx?.model || (row.provider === 'fal' ? ((row.endpoint as string | null) ?? null) : null)
    const shown = customerModel({
      requestedModel: requested,
      model: billedModel,
      provider: (row.provider as string | null) ?? null,
    })
    const created = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
    return {
      id: String(row.id),
      createdAt: created,
      memberUserId: String(row.user_id),
      modelLabel: shown.label,
      jobType: shown.jobType,
      status: String(row.status ?? ''),
      credits: Number(row.credits) || 0,
      releaseReason: releaseReasonWording(
        row.release_reason == null ? null : String(row.release_reason)
      ),
    }
  })
  const extra = rows[limit]
  const last = items[items.length - 1]
  const nextCursor = extra && last ? encodeCursor(last.createdAt, last.id) : null
  return { items, nextCursor }
}

/** Shared CSV for org + billing jobs routes. */
export function jobsCsv(items: JobRow[]): string {
  const lines = [
    csvLine(['Time', 'Member', 'Model', 'Job type', 'Status', 'Credits', 'Release reason'].map((c) => csvCell(c))),
    ...items.map((row) =>
      csvLine([
        csvCell(row.createdAt),
        csvCell(row.memberUserId),
        csvCell(row.modelLabel),
        csvCell(row.jobType),
        csvCell(row.status),
        csvCell(row.credits, 'number'),
        csvCell(row.releaseReason),
      ])
    ),
  ]
  return lines.join('')
}
