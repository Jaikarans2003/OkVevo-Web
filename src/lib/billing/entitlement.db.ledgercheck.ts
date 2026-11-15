/**
 * Past currentPeriodEnd refuses reserve even when planStatus is active.
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/billing/entitlement.db.selfcheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { ensureUserAndBilling, updateBillingByUserId } = await import('@/lib/db/wallet')
const { PlanNotActiveError, reserveCredits } = await import('@/lib/gateway/debit')

const uid = `ent-${Date.now()}`
await ensureUserAndBilling(sql, uid)
await updateBillingByUserId(sql, uid, {
  plan: 'starter',
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() - 60_000),
  allocationBalance: 500,
  topUpBalance: 0,
})

let denied = false
try {
  await reserveCredits({
    uid,
    requestId: `${uid}-a`,
    provider: 'openrouter',
    estimatedCredits: 10,
  })
} catch (err) {
  denied = err instanceof PlanNotActiveError
}
assert.equal(denied, true, 'lapsed currentPeriodEnd must raise PlanNotActiveError')
console.log('entitlement.db.selfcheck: ok')
await sql.end({ timeout: 1 })
