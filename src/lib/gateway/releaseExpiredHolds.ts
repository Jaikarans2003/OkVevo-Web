/**
 * Release chat/tavily holds past hold_expires_at.
 * Cron: POST /api/cron/release-expired-holds every 5 min.
 */
import { sql } from '@/lib/db/client'
import { releaseCredits } from '@/lib/gateway/debit'

export async function releaseExpiredHolds(
  now: Date = new Date()
): Promise<{ scanned: number; released: number }> {
  const rows = await sql`
    select id
    from gateway_jobs
    where status = 'reserved'
      and hold_expires_at is not null
      and hold_expires_at < ${now}
    order by hold_expires_at
    limit 200
  `
  let released = 0
  for (const row of rows) {
    const id = String(row.id)
    const ok = await releaseCredits(id, {
      from: ['reserved'],
      patch: { releaseReason: 'expired' },
    })
    if (ok) released += 1
  }
  return { scanned: rows.length, released }
}
