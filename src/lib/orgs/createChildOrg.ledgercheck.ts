/**
 * Child org create + purchase-block semantics against local Supabase.
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { ensureUserAndBilling, getBillingByOrgId } = await import('@/lib/db/wallet')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const { createChildOrg } = await import('@/lib/orgs/createChildOrg')
const { authorizeOrg } = await import('@/lib/orgs/authorize')
const { rejectChildOrgPurchase } = await import('@/lib/orgs/orgContext')

const uid = `child-${Date.now().toString(16)}`
await ensureUserAndBilling(sql, uid)

const upgraded = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: uid, name: 'Acme', kind: 'super_org' })
)
assert.ok(upgraded.ok)
if (!upgraded.ok) throw new Error('upgrade failed')

const child = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: upgraded.orgId,
    name: 'Acme Studio',
    ownerUserId: uid,
  })
)
assert.ok(child.ok)
if (!child.ok) throw new Error('create child failed')

const wallet = await getBillingByOrgId(sql, child.orgId)
assert.equal(wallet?.accessMode, 'prepaid')
assert.equal(wallet?.accountKind, 'org')
assert.equal(wallet?.topUpBalance, 0)

// Owner can read/spend; stranger cannot
const ok = await authorizeOrg(sql, {
  userId: uid,
  orgPublicId: child.orgPublicId,
  need: 'spend',
})
assert.equal(ok.ok, true)

const stranger = await authorizeOrg(sql, {
  userId: 'stranger-uid',
  orgPublicId: child.orgPublicId,
  need: 'read',
})
assert.equal(stranger.ok, false)
if (!stranger.ok) assert.equal(stranger.code, 'org_access_denied')

// Purchase block via header
const blocked = await rejectChildOrgPurchase(sql, {
  req: {
    headers: { get: (k: string) => (k.toLowerCase() === 'x-okvevo-org' ? child.orgPublicId : null) },
  } as never,
  userId: uid,
})
assert.equal(blocked.blocked, true)
if (blocked.blocked) assert.equal(blocked.code, 'org_managed_by_super_org')

// Super-org header → not blocked (subscription wallet)
const parent = await sql`select public_id from organizations where id = ${upgraded.orgId}`
const parentPublicId = String(parent[0]!.public_id)
const allowed = await rejectChildOrgPurchase(sql, {
  req: {
    headers: { get: (k: string) => (k.toLowerCase() === 'x-okvevo-org' ? parentPublicId : null) },
  } as never,
  userId: uid,
})
assert.equal(allowed.blocked, false)

// No header → not blocked
const personal = await rejectChildOrgPurchase(sql, {
  req: { headers: { get: () => null } } as never,
  userId: uid,
})
assert.equal(personal.blocked, false)
assert.equal(personal.org, null)

// Creating under non-super parent fails
const bad = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: child.orgId,
    name: 'Nested',
    ownerUserId: uid,
  })
)
assert.equal(bad.ok, false)
if (!bad.ok) assert.equal(bad.code, 'parent_not_super_org')

console.log('createChildOrg.ledgercheck: ok')
await sql.end({ timeout: 1 })
