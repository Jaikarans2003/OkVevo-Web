/**
 * Layer 1: open RELEASABLE holds reduce cached balance in findLedgerMismatches.
 * Run: DATABASE_URL=… npx tsx src/lib/billing/ledgerInvariant.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { ensureUserAndBilling, getBillingByUserId } = await import('@/lib/db/wallet')
const { grantCredits, reserveCredits, releaseCredits } = await import('@/lib/gateway/debit')
const { findLedgerMismatches } = await import('@/lib/billing/ledgerInvariant')
const { RELEASABLE } = await import('@/lib/gateway/reserve')

const stamp = Date.now().toString(16)
const uid = `li-hold-${stamp}`
const holdId = `li-hold-job-${stamp}`

assert.ok(RELEASABLE.has('reserved'), 'reserved must be RELEASABLE')
assert.ok(!(RELEASABLE as ReadonlySet<string>).has('settled'), 'settled must not be RELEASABLE')

await ensureUserAndBilling(sql, uid)
await grantCredits({
  uid,
  amount: 100,
  bucket: 'allocation',
  mode: 'set',
  reason: 'ledgerInvariant.ledgercheck',
  requestId: `li-grant-${stamp}`,
})

const reserved = await reserveCredits({
  uid,
  requestId: holdId,
  provider: 'openrouter',
  estimatedCredits: 40,
})
assert.equal(reserved.ok, true, `reserve failed: ${JSON.stringify(reserved)}`)

const wallet = await getBillingByUserId(sql, uid)
assert.ok(wallet)
assert.equal(wallet!.allocationBalance, 60)

const openHoldMismatches = (await findLedgerMismatches(sql)).filter(
  (m) => m.billingAccountId === wallet!.id
)
assert.equal(
  openHoldMismatches.length,
  0,
  `open hold must keep invariant green: ${JSON.stringify(openHoldMismatches)}`
)

// Settled is not RELEASABLE — hold must not subtract (would hide a real hole).
await sql`
  update gateway_jobs
  set status = 'settled', held_allocation = 40, held_top_up = 0
  where id = ${holdId}
`
const settledHoldMismatches = (await findLedgerMismatches(sql)).filter(
  (m) => m.billingAccountId === wallet!.id
)
assert.equal(settledHoldMismatches.length, 1)
assert.equal(settledHoldMismatches[0]!.holdAlloc, 0)
assert.equal(settledHoldMismatches[0]!.allocDelta, -40)

await sql`
  update gateway_jobs
  set status = 'reserved', held_allocation = 40
  where id = ${holdId}
`
await releaseCredits(holdId, { from: ['reserved'] })

console.log('ledgerInvariant.ledgercheck: ok')
await sql.end({ timeout: 1 })
