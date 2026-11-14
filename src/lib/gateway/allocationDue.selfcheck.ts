/**
 * Allocation due inside the reserve transaction: overdue SET lands before spend.
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/gateway/allocationDue.selfcheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { ensureUserAndBilling, getBillingByUserId, updateBillingByUserId } = await import(
  '@/lib/db/wallet'
)
const { reserveCredits } = await import('@/lib/gateway/debit')

const uid = `allocdue-${Date.now()}`
await ensureUserAndBilling(sql, uid)
await updateBillingByUserId(sql, uid, {
  plan: 'starter',
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  creditsIncluded: 500,
  allocationBalance: 10,
  topUpBalance: 0,
  nextAllocationDate: new Date(Date.now() - 60_000),
})

await reserveCredits({
  uid,
  requestId: `${uid}-a`,
  provider: 'openrouter',
  estimatedCredits: 50,
})

const billing = await getBillingByUserId(sql, uid)
assert.ok(billing)
assert.equal(billing.allocationBalance, 450, 'SET 500 then hold 50')
assert.ok(billing.nextAllocationDate && billing.nextAllocationDate.getTime() > Date.now())

console.log('allocationDue.selfcheck: ok')
await sql.end({ timeout: 1 })
