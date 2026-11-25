import { decodeCursor, encodeCursor } from '@/lib/analytics/cursor'
import { notAliasJob } from '@/lib/analytics/jobScope'
import { releaseReasonWording } from '@/lib/analytics/releaseReasonCopy'
import type { DbHandle } from '@/lib/db/wallet'
import { customerModel } from '@/lib/gateway/modelCatalog'

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

/** Customer jobs page. The row is an explicit field list. */
export async function listOrgJobs(
  db: DbHandle,
  opts: { orgId: string; userId?: string | null; limit?: number; cursor?: string | null }
): Promise<{ items: JobRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? PAGE, 1), PAGE)
  const cursor = decodeCursor(opts.cursor ?? null)
  const rows = await db`
    select id, created_at, user_id, requested_model, provider, status,
           coalesce(settled_credits, estimated_credits, 0)::int as credits,
           release_reason
    from gateway_jobs
    where org_id = ${opts.orgId}
      and ${notAliasJob(db)}
      ${opts.userId ? db`and user_id = ${opts.userId}` : db``}
      ${cursor ? db`and (created_at, id) < (${cursor.at}::timestamptz, ${cursor.id})` : db``}
    order by created_at desc, id desc
    limit ${limit + 1}
  `
  const page = rows.slice(0, limit)
  const items: JobRow[] = page.map((row) => {
    const shown = customerModel({
      requestedModel: (row.requested_model as string | null) ?? null,
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
