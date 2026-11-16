/**
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/gateway/releaseExpiredHolds.selfcheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { ensureUserAndBilling, getJob, updateBillingByUserId, updateJob } = await import(
  '@/lib/db/wallet'
)
const { reserveCredits } = await import('@/lib/gateway/debit')
const { releaseExpiredHolds } = await import('@/lib/gateway/releaseExpiredHolds')

const uid = `exp-${Date.now()}`
const requestId = `${uid}-hold`
await ensureUserAndBilling(sql, uid)
await updateBillingByUserId(sql, uid, {
  plan: 'starter',
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  allocationBalance: 200,
  topUpBalance: 0,
})

await reserveCredits({
  uid,
  requestId,
  provider: 'openrouter',
  estimatedCredits: 50,
})

const before = await getJob(sql, requestId)
assert.equal(before?.status, 'reserved')
assert.ok(before?.holdExpiresAt instanceof Date)

await updateJob(sql, requestId, { holdExpiresAt: new Date(Date.now() - 1000) })
const result = await releaseExpiredHolds(new Date())
assert.ok(result.released >= 1)
const after = await getJob(sql, requestId)
assert.equal(after?.status, 'released')
assert.equal(after?.releaseReason, 'expired')

const billing = await (await import('@/lib/db/wallet')).getBillingByUserId(sql, uid)
assert.equal(billing?.allocationBalance, 200)

console.log('releaseExpiredHolds.selfcheck: ok')
await sql.end({ timeout: 1 })
