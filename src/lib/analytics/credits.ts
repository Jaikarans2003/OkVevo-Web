import { decodeCursor, encodeCursor } from '@/lib/analytics/cursor'
import type { DbHandle } from '@/lib/db/wallet'
import { customerModel } from '@/lib/gateway/modelCatalog'

export type CreditRow = {
  id: string
  createdAt: string
  memberUserId: string | null
  modelLabel: string
  jobType: string
  bucket: string
  credits: number
  requestId: string | null
}

const PAGE = 50

/** Customer credit lines. Provider, cost, and price stay in the database. */
export async function listOrgCredits(
  db: DbHandle,
  opts: { orgId: string; userId?: string | null; limit?: number; cursor?: string | null }
): Promise<{ items: CreditRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? PAGE, 1), PAGE)
  const cursor = decodeCursor(opts.cursor ?? null)
  const rows = await db`
    select id, created_at, user_id, requested_model, model, provider, bucket, amount, request_id
    from credit_transactions
    where org_id = ${opts.orgId}
      and type in ('debit', 'refund')
      ${opts.userId ? db`and user_id = ${opts.userId}` : db``}
      ${cursor ? db`and (created_at, id) < (${cursor.at}::timestamptz, ${cursor.id})` : db``}
    order by created_at desc, id desc
    limit ${limit + 1}
  `
  const page = rows.slice(0, limit)
  const items: CreditRow[] = page.map((row) => {
    const shown = customerModel({
      requestedModel: (row.requested_model as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      provider: (row.provider as string | null) ?? null,
    })
    return {
      id: String(row.id),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      memberUserId: row.user_id == null ? null : String(row.user_id),
      modelLabel: shown.label,
      jobType: shown.jobType,
      bucket: String(row.bucket ?? ''),
      credits: Number(row.amount) || 0,
      requestId: row.request_id == null ? null : String(row.request_id),
    }
  })
  const last = items[items.length - 1]
  const nextCursor = rows[limit] && last ? encodeCursor(last.createdAt, last.id) : null
  return { items, nextCursor }
}
