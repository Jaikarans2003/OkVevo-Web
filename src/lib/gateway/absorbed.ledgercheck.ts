/**
 * Ledger amount matches wallet debit; absorbed covers the shortfall.
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/gateway/absorbed.selfcheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { ensureUserAndBilling, getBillingByUserId, updateBillingByUserId } = await import(
  '@/lib/db/wallet'
)
const { reconcileCredits, reserveCredits } = await import('@/lib/gateway/debit')

const uid = `abs-${Date.now()}`
const requestId = `${uid}-job`
await ensureUserAndBilling(sql, uid)
await updateBillingByUserId(sql, uid, {
  plan: 'starter',
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  allocationBalance: 40,
  topUpBalance: 10,
})

await reserveCredits({
  uid,
  requestId,
  provider: 'openrouter',
  estimatedCredits: 40,
})

// Drain remaining top-up outside the hold so settle overshoots available.
await updateBillingByUserId(sql, uid, { topUpBalance: 0 })

await reconcileCredits({
  requestId,
  actualCredits: 55,
  provider: 'openrouter',
})

const billing = await getBillingByUserId(sql, uid)
assert.equal(billing?.allocationBalance, 0)
assert.equal(billing?.topUpBalance, 0)

const txn = await sql`select amount, absorbed from credit_transactions where id = ${requestId}`
assert.equal(Number(txn[0]?.amount), 40) // restored 40+0 held, top-up gone → take 40
assert.equal(Number(txn[0]?.absorbed), 15)

console.log('absorbed.selfcheck: ok')
await sql.end({ timeout: 1 })
