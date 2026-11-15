/**
 * Cursor page for GET /api/billing/transactions.
 * Owner of the personal wallet only in PR 1 (no org memberships).
 */
import { sql } from '@/lib/db/client'
import { getBillingByUserId } from '@/lib/db/wallet'

export type LedgerItem = {
  id: string
  type: string
  amount: number
  bucket: string | null
  absorbed: number
  reason: string | null
  requestId: string | null
  provider: string | null
  model: string | null
  createdAt: string
}

export type LedgerPage = {
  items: LedgerItem[]
  nextCursor: string | null
}

const PAGE_SIZE = 50

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const pipe = raw.indexOf('|')
    if (pipe < 0) return null
    const createdAt = new Date(raw.slice(0, pipe))
    const id = raw.slice(pipe + 1)
    if (Number.isNaN(createdAt.getTime()) || !id) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

export async function listBillingTransactions(
  uid: string,
  cursor: string | null
): Promise<LedgerPage> {
  const billing = await getBillingByUserId(sql, uid)
  if (!billing) return { items: [], nextCursor: null }

  const decoded = cursor ? decodeCursor(cursor) : null
  if (cursor && !decoded) {
    throw new Error('invalid_cursor')
  }

  const rows = decoded
    ? await sql`
        select id, type, amount, bucket, absorbed, reason, request_id, provider, model, created_at
        from credit_transactions
        where billing_account_id = ${billing.id}
          and (created_at, id) < (${decoded.createdAt}, ${decoded.id})
        order by created_at desc, id desc
        limit ${PAGE_SIZE + 1}
      `
    : await sql`
        select id, type, amount, bucket, absorbed, reason, request_id, provider, model, created_at
        from credit_transactions
        where billing_account_id = ${billing.id}
        order by created_at desc, id desc
        limit ${PAGE_SIZE + 1}
      `

  const page = rows.slice(0, PAGE_SIZE)
  const items: LedgerItem[] = page.map((r) => {
    const row = r as Record<string, unknown>
    const createdAt = row.created_at as Date
    return {
      id: String(row.id),
      type: String(row.type),
      amount: Number(row.amount) || 0,
      bucket: (row.bucket as string | null) ?? null,
      absorbed: Number(row.absorbed) || 0,
      reason: (row.reason as string | null) ?? null,
      requestId: (row.request_id as string | null) ?? null,
      provider: (row.provider as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      createdAt: createdAt.toISOString(),
    }
  })

  let nextCursor: string | null = null
  if (rows.length > PAGE_SIZE && page.length > 0) {
    const last = page[page.length - 1] as Record<string, unknown>
    nextCursor = encodeCursor(last.created_at as Date, String(last.id))
  }
  return { items, nextCursor }
}
