/**
 * Admitted work is charged even if current_period_end lapses mid-call.
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/gateway/reconcileAfterLapse.selfcheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { ensureUserAndBilling, getBillingByUserId, getJob, updateBillingByUserId } = await import(
  '@/lib/db/wallet'
)
const { reconcileCredits, reserveCredits } = await import('@/lib/gateway/debit')

const uid = `lapse-${Date.now()}`
const requestId = `${uid}-job`
await ensureUserAndBilling(sql, uid)
await updateBillingByUserId(sql, uid, {
  plan: 'starter',
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  allocationBalance: 100,
  topUpBalance: 0,
})

await reserveCredits({
  uid,
  requestId,
  provider: 'openrouter',
  estimatedCredits: 40,
})

await updateBillingByUserId(sql, uid, {
  currentPeriodEnd: new Date(Date.now() - 60_000),
})

await reconcileCredits({
  requestId,
  actualCredits: 25,
  provider: 'openrouter',
})

const job = await getJob(sql, requestId)
assert.equal(job?.status, 'settled')
assert.equal(job?.actualCredits, 25)

const billing = await getBillingByUserId(sql, uid)
assert.equal(billing?.allocationBalance, 75) // 100 - 40 hold + 40 restore - 25 debit

const txn = await sql`select type, amount, absorbed from credit_transactions where id = ${requestId}`
assert.equal(txn[0]?.type, 'debit')
assert.equal(Number(txn[0]?.amount), 25)
assert.equal(Number(txn[0]?.absorbed ?? 0), 0)

console.log('reconcileAfterLapse.selfcheck: ok')
await sql.end({ timeout: 1 })
