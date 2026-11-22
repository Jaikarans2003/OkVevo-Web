/**
 * Plaintext join codes + membership against local Supabase.
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { ensureUserAndBilling } = await import('@/lib/db/wallet')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const {
  createJoinCode,
  joinOrgAsMember,
  lookupJoinCode,
  revokeJoinCode,
  userCannotJoinByCode,
} = await import('@/lib/orgs/joinCodes')
const { removeMember, setMemberRole } = await import('@/lib/orgs/members')
const { authorizeOrg } = await import('@/lib/orgs/authorize')

const owner = `own-${Date.now().toString(16)}`
const joiner = `join-${Date.now().toString(16)}`
await ensureUserAndBilling(sql, owner)
await ensureUserAndBilling(sql, joiner)

const upgraded = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: owner, name: 'JoinCo', kind: 'org' })
)
assert.ok(upgraded.ok)
if (!upgraded.ok) throw new Error('upgrade')

// --- join code happy path ---
await withTx(async (tx) => {
  await tx`update join_codes set revoked_at = now() where org_id = ${upgraded.orgId} and revoked_at is null`
})
const minted = await withTx((tx) =>
  createJoinCode(tx, { orgId: upgraded.orgId, createdBy: owner, kind: 'org' })
)

const redeemed = await withTx(async (tx) => {
  const found = await lookupJoinCode(tx, minted.code)
  assert.ok(found)
  assert.equal(found.revokedAt, null)
  return joinOrgAsMember(tx, { orgId: found.orgId, userId: joiner })
})
assert.equal(redeemed.ok, true)

const other = `oth-${Date.now().toString(16)}`
await ensureUserAndBilling(sql, other)
const again = await withTx(async (tx) => {
  const found = await lookupJoinCode(tx, minted.code)
  assert.ok(found)
  return joinOrgAsMember(tx, { orgId: found.orgId, userId: other })
})
assert.equal(again.ok, true)

// revoked code
await withTx(async (tx) => {
  await tx`update join_codes set revoked_at = now() where org_id = ${upgraded.orgId} and revoked_at is null`
})
const minted2 = await withTx((tx) =>
  createJoinCode(tx, { orgId: upgraded.orgId, createdBy: owner, kind: 'org' })
)
await withTx((tx) =>
  revokeJoinCode(tx, { orgId: upgraded.orgId, joinCodeId: minted2.id, actorUserId: owner })
)
const revokedLookup = await withTx((tx) => lookupJoinCode(tx, minted2.code))
assert.ok(revokedLookup?.revokedAt)

// removed member → org_access_denied
await withTx((tx) => removeMember(tx, { orgId: upgraded.orgId, userId: joiner }))
const denied = await authorizeOrg(sql, {
  userId: joiner,
  orgPublicId: upgraded.orgPublicId,
  need: 'read',
})
assert.equal(denied.ok, false)
if (!denied.ok) assert.equal(denied.code, 'org_access_denied')

// last owner cannot be removed
const last = await withTx((tx) => removeMember(tx, { orgId: upgraded.orgId, userId: owner }))
assert.equal(last.ok, false)
if (!last.ok) assert.equal(last.code, 'last_owner')

// demote last owner blocked
const demote = await withTx((tx) =>
  setMemberRole(tx, { orgId: upgraded.orgId, userId: owner, role: 'member' })
)
assert.equal(demote.ok, false)
if (!demote.ok) assert.equal(demote.code, 'last_owner')

assert.equal(await userCannotJoinByCode(sql, joiner), false)
assert.equal(await userCannotJoinByCode(sql, owner), true)

console.log('membership.ledgercheck: ok')
await sql.end({ timeout: 1 })