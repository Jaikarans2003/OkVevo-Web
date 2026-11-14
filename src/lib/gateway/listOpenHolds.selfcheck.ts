/**
 * listOpenHolds runs inside the reserve transaction: a second reserve sees
 * the first hold's in-flight credits.
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/gateway/listOpenHolds.selfcheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { ensureUserAndBilling, updateBillingByUserId } = await import('@/lib/db/wallet')
const { sql } = await import('@/lib/db/client')
const { InFlightBudgetError, reserveCredits } = await import('@/lib/gateway/debit')

const uid = `holds-${Date.now()}`
await ensureUserAndBilling(sql, uid)
await updateBillingByUserId(sql, uid, {
  plan: 'starter',
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  allocationBalance: 150,
  topUpBalance: 0,
})

await reserveCredits({
  uid,
  requestId: `${uid}-a`,
  provider: 'openrouter',
  estimatedCredits: 100,
})

let denied = false
try {
  await reserveCredits({
    uid,
    requestId: `${uid}-b`,
    provider: 'openrouter',
    estimatedCredits: 100,
  })
} catch (err) {
  denied = err instanceof InFlightBudgetError
}

assert.equal(denied, true, 'second reserve must see first hold and raise InFlightBudgetError')
console.log('listOpenHolds.selfcheck: ok')
await sql.end({ timeout: 1 })
