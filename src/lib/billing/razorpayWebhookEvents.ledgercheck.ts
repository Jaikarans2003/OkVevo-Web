/**
 * Run against local Postgres:
 * DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/billing/razorpayWebhookEvents.selfcheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { claimWebhookEventId, releaseWebhookEventId } = await import(
  '@/lib/billing/razorpayWebhookEvents'
)

const id = `evt-selfcheck-${Date.now()}`
assert.equal(await claimWebhookEventId(id, 'subscription.charged'), true)
assert.equal(await claimWebhookEventId(id, 'subscription.charged'), false)
await releaseWebhookEventId(id)
assert.equal(await claimWebhookEventId(id, 'subscription.charged'), true)
await releaseWebhookEventId(id)
console.log('razorpayWebhookEvents.selfcheck: ok')
await sql.end({ timeout: 1 })
