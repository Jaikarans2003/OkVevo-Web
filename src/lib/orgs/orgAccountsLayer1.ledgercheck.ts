/**
 * Layer 1 PR2 org scenarios (plan §9 subset runnable without Playwright).
 * Covers: upgrade→super→child, transfer+debt, creditLimit, expiry, purchase block, authz.
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const {
  ensureUserAndBilling,
  getBillingByOrgId,
  insertCreditTransaction,
  updateBillingById,
} = await import('@/lib/db/wallet')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const { createChildOrg } = await import('@/lib/orgs/createChildOrg')
const { transferCredits } = await import('@/lib/orgs/transferCredits')
const { computeCreditLimit } = await import('@/lib/orgs/creditLimit')
const { expireAdditionalForWallet } = await import('@/lib/orgs/expireAdditional')
const { rejectChildOrgPurchase } = await import('@/lib/orgs/orgContext')
const { authorizeOrg } = await import('@/lib/orgs/authorize')
const { applyReserve } = await import('@/lib/gateway/reserve')

const owner = `l1o-${Date.now().toString(16)}`
await ensureUserAndBilling(sql, owner)

const superUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: owner, name: 'L1 Super', kind: 'super_org' })
)
assert.ok(superUp.ok)
if (!superUp.ok) throw new Error('super')

const child = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: superUp.orgId,
    name: 'L1 Child',
    ownerUserId: owner,
  })
)
assert.ok(child.ok)
if (!child.ok) throw new Error('child')

const superBilling = await getBillingByOrgId(sql, superUp.orgId)
assert.ok(superBilling)
const exp = new Date(Date.now() + 365 * 864e5)
await insertCreditTransaction(sql, `l1g_${owner}`, superBilling!.id, {
  org_id: superUp.orgId,
  type: 'grant',
  amount: 1000,
  bucket: 'top_up',
  expires_at: exp,
  reason: 'seed',
})
await updateBillingById(sql, superBilling!.id, {
  topUpBalance: 1000,
  topUpReference: 1000,
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
})

// Drive child into debt via creditLimit path: seed then negative via update (prepaid)
await updateBillingById(sql, child.billingAccountId, {
  topUpBalance: -300,
  topUpReference: 0,
})

const xfer = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superUp.orgId,
    toOrgId: child.orgId,
    credits: 1000,
    idempotencyKey: `l1-${owner}`,
    actorUserId: owner,
  })
)
assert.ok(xfer.ok)
if (!xfer.ok) throw new Error('unreachable')
assert.equal(xfer.debtRecovered, 300)
assert.equal(xfer.toBalance, 700)

const limit = await computeCreditLimit(sql, child.billingAccountId)
assert.equal(limit, Math.floor(1000 * 0.015))

// Expiry: seed an old inflow on child remaining credits
const past = new Date('2020-01-01T00:00:00.000Z')
await sql`
  update credit_transactions
  set expires_at = ${past}
  where billing_account_id = ${child.billingAccountId}
    and type = 'transfer_in'
`
const childAfter = await getBillingByOrgId(sql, child.orgId)
const expiring = await withTx((tx) =>
  expireAdditionalForWallet(tx, child.billingAccountId, new Date('2027-01-01'))
)
// All inflows past → expire full positive balance
assert.equal(expiring.expired, childAfter?.topUpBalance)

// Purchase block
const block = await rejectChildOrgPurchase(sql, {
  req: {
    headers: {
      get: (k: string) => (k.toLowerCase() === 'x-okvevo-org' ? child.orgPublicId : null),
    },
  } as never,
  userId: owner,
})
assert.equal(block.blocked, true)
if (block.blocked) assert.equal(block.code, 'org_managed_by_super_org')

// Authz: stranger denied
const denied = await authorizeOrg(sql, {
  userId: 'stranger',
  orgPublicId: child.orgPublicId,
  need: 'read',
})
assert.equal(denied.ok, false)

// creditLimit=0 identity (plan §9 test 2 sample)
const a = applyReserve(
  { allocationBalance: 100, topUpBalance: 50 },
  undefined,
  120,
  owner,
  'openrouter'
)
const b = applyReserve(
  { allocationBalance: 100, topUpBalance: 50 },
  undefined,
  120,
  owner,
  'openrouter',
  0
)
assert.deepEqual(a, b)

console.log('orgAccountsLayer1.ledgercheck: ok')
await sql.end({ timeout: 1 })
