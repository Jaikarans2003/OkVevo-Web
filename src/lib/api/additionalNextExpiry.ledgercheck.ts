import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const {
  ensureUserAndBilling,
  getBillingByUserId,
  insertCreditTransaction,
  updateBillingByUserId,
} = await import('@/lib/db/wallet')
const { loadAdditionalNextExpiry, billingSummaryFromAccount } = await import(
  '@/lib/api/billingSummary'
)

const uid = `expui-${Date.now().toString(16)}`
await ensureUserAndBilling(sql, uid)
const b = await getBillingByUserId(sql, uid)
assert.ok(b)
await insertCreditTransaction(sql, `g1_${uid}`, b!.id, {
  user_id: uid,
  type: 'grant',
  amount: 100,
  bucket: 'top_up',
  expires_at: new Date('2030-06-01T00:00:00.000Z'),
  reason: 't',
})
await updateBillingByUserId(sql, uid, { topUpBalance: 100, topUpReference: 100 })
const next = await loadAdditionalNextExpiry(sql, b!.id, new Date('2026-01-01'))
assert.ok(next)
assert.ok(next!.startsWith('2030-06-01'))
const s = billingSummaryFromAccount(b, new Date(), { additionalNextExpiry: next })
assert.equal(s.additionalNextExpiry, next)

console.log('additionalNextExpiry.ledgercheck: ok')
await sql.end({ timeout: 1 })
