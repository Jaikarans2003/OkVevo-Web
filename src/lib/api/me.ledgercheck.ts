/**
 * GET/PATCH me + billing summary/transactions + contact insert against local Postgres.
 * Run: DATABASE_URL=… npx tsx src/lib/api/me.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.ADMIN_EMAILS = 'admin@okvevo.com'

const { sql } = await import('@/lib/db/client')
const { getMePayload, isPlatformAdmin, patchMe } = await import('@/lib/api/me')
const { billingSummaryFromAccount } = await import('@/lib/api/billingSummary')
const { listBillingTransactions } = await import('@/lib/api/billingTransactions')
const { insertContactSubmission, validateContactInput } = await import('@/lib/api/contact')
const { getBillingByUserId, insertCreditTransaction, updateBillingByUserId } = await import(
  '@/lib/db/wallet'
)

const uid = `me-api-${Date.now()}`

assert.equal(isPlatformAdmin({ email: 'admin@okvevo.com', email_verified: true }), true)
assert.equal(isPlatformAdmin({ email: 'admin@okvevo.com', email_verified: false }), false)
assert.equal(isPlatformAdmin({ email: 'other@okvevo.com', email_verified: true }), false)

const me = await getMePayload(uid, {
  email: 'user@example.com',
  email_verified: true,
  name: 'Test User',
})
assert.equal(me.user.id, uid)
assert.equal(me.user.email, 'user@example.com')
assert.equal(me.user.displayName, 'Test User')
assert.equal(me.hidePersonal, false)
assert.deepEqual(me.memberships, [])
assert.equal(me.isPlatformAdmin, false)

const billing = await getBillingByUserId(sql, uid)
assert.ok(billing, 'billing_accounts row created')
assert.equal(billing.ownerUserId, uid)

const patched = await patchMe(uid, {
  displayName: 'Patched',
  phoneNumber: '+15551212',
  bio: 'hello',
})
assert.equal(patched.displayName, 'Patched')
assert.equal(patched.phoneNumber, '+15551212')
assert.equal(patched.bio, 'hello')

await updateBillingByUserId(sql, uid, {
  plan: 'starter',
  planStatus: 'active',
  creditsIncluded: 20_000,
  allocationBalance: 10_000,
  allocationGrantedTotal: 20_000,
  topUpBalance: 250,
  topUpReference: 500,
  topUpPurchasedTotal: 500,
  currentPeriodEnd: new Date(Date.now() + 864e5),
})
const refreshed = await getBillingByUserId(sql, uid)
const summary = billingSummaryFromAccount(refreshed)
assert.equal(summary.remainingPct, 50)
assert.equal(summary.additionalPct, 50)
assert.equal(summary.entitled, true)
assert.equal('allocationBalance' in summary, false)

await insertCreditTransaction(sql, `${uid}-debit`, billing!.id, {
  user_id: uid,
  type: 'debit',
  amount: 10,
  bucket: 'allocation',
  absorbed: 0,
})
const page = await listBillingTransactions(uid, null)
assert.equal(page.items.length, 1)
assert.equal(page.items[0].type, 'debit')
assert.equal(page.items[0].amount, 10)
assert.equal(page.nextCursor, null)

const bad = validateContactInput({ category: '', email: 'x', message: '' })
assert.equal(bad.ok, false)

const good = validateContactInput({
  category: 'generalQuery',
  email: 'hi@okvevo.com',
  message: 'Need help',
  whatsapp: '+91',
})
assert.equal(good.ok, true)
if (good.ok) {
  const id = await insertContactSubmission(good.value)
  assert.ok(id)
  const rows = await sql`select category, email from contact_submissions where id = ${id}`
  assert.equal(rows[0]?.category, 'generalQuery')
  assert.equal(rows[0]?.email, 'hi@okvevo.com')
}

console.log('me.ledgercheck: ok')
await sql.end({ timeout: 1 })
