/**
 * Cron allocation SET re-checks the locked row: charged then cron → one SET.
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/gateway/allocationCronRace.selfcheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { refreshAllocationIfDue } = await import('@/lib/billing/allocation')
const { sql } = await import('@/lib/db/client')
const { ensureUserAndBilling, getBillingByUserId, updateBillingByUserId } = await import(
  '@/lib/db/wallet'
)
const { grantCredits } = await import('@/lib/gateway/debit')

const uid = `race-${Date.now()}`
const dueAt = new Date(Date.now() - 60_000)
await ensureUserAndBilling(sql, uid)
await updateBillingByUserId(sql, uid, {
  plan: 'starter',
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  creditsIncluded: 500,
  allocationBalance: 12,
  topUpBalance: 0,
  nextAllocationDate: dueAt,
})

const pre = await getBillingByUserId(sql, uid)
assert.ok(pre)
const refresh = refreshAllocationIfDue({
  planStatus: pre.planStatus,
  creditsIncluded: pre.creditsIncluded,
  allocationBalance: pre.allocationBalance,
  nextAllocationDate: pre.nextAllocationDate,
})
assert.ok(refresh)

// subscription.charged wins first (no cron re-check on this path)
await grantCredits({
  uid,
  amount: refresh.allocationBalance,
  reason: 'subscription.charged',
  bucket: 'allocation',
  requestId: `sub_charged_${uid}_1`,
  userPatch: { nextAllocationDate: refresh.nextAllocationDate },
})

// Cron then runs with a stale "still due" view — must skip after locked re-check
await grantCredits({
  uid,
  amount: refresh.allocationBalance,
  reason: 'cron.allocation_refresh',
  bucket: 'allocation',
  requestId: `cron_alloc_${uid}_${refresh.nextAllocationDate.getTime()}`,
  userPatch: { nextAllocationDate: refresh.nextAllocationDate },
})

const grants = await sql`
  select reason, amount from credit_transactions
  where user_id = ${uid} and type = 'grant' and bucket = 'allocation' and mode = 'set'
`
assert.equal(grants.length, 1)
assert.equal(grants[0]?.reason, 'subscription.charged')
assert.equal(Number(grants[0]?.amount), 500)

const billing = await getBillingByUserId(sql, uid)
assert.equal(billing?.allocationBalance, 500)
assert.ok(billing?.nextAllocationDate && billing.nextAllocationDate.getTime() > Date.now())

console.log('allocationCronRace.selfcheck: ok')
await sql.end({ timeout: 1 })
