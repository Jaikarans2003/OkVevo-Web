/**
 * At-least-once Razorpay delivery: claim x-razorpay-event-id once.
 */
import type { Sql } from 'postgres'

import { sql as defaultSql } from '@/lib/db/client'

type Db = Sql | typeof defaultSql

/** Insert event id. Returns true if this is the first sighting. */
export async function claimWebhookEventId(
  eventId: string,
  eventType: string | null,
  db: Db = defaultSql
): Promise<boolean> {
  const rows = await db`
    insert into razorpay_webhook_events (event_id, event_type)
    values (${eventId}, ${eventType})
    on conflict (event_id) do nothing
    returning event_id
  `
  return rows.length > 0
}

/** Allow Razorpay to retry after a handler crash mid-flight. */
export async function releaseWebhookEventId(
  eventId: string,
  db: Db = defaultSql
): Promise<void> {
  await db`delete from razorpay_webhook_events where event_id = ${eventId}`
}
