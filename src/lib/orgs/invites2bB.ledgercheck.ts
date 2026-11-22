/**
 * PR 2b-b Layer 1: invites, join codes, org invitations, audit.
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { ensureUserAndBilling } = await import('@/lib/db/wallet')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const {
  createInvitation,
  acceptInvitation,
  declineInvitation,
  listPendingInvitesWithTokensForEmail,
  getInvitationByIdForAccept,
  declineInvitationById,
} = await import('@/lib/orgs/invitations')
const {
  createJoinCode,
  redeemJoinCode,
  regenerateJoinCode,
  userCannotJoinByCode,
} = await import('@/lib/orgs/joinCodes')
const {
  createOrgInvitation,
  declineOrgInvitation,
  findPendingOrgInvitation,
  markOrgInvitationAccepted,
} = await import('@/lib/orgs/orgInvitations')
const { acceptParent } = await import('@/lib/orgs/acceptParent')
const { createChildOrg } = await import('@/lib/orgs/createChildOrg')

const stamp = Date.now().toString(16)
const owner = `o-${stamp}`
const invitee = `i-${stamp}`
await ensureUserAndBilling(sql, owner)
await ensureUserAndBilling(sql, invitee)
await sql`update users set email = ${`owner-${stamp}@example.com`} where id = ${owner}`
await sql`update users set email = ${`invitee-${stamp}@example.com`} where id = ${invitee}`

const upgraded = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: owner, name: 'InviteCo' })
)
assert.ok(upgraded.ok)
if (!upgraded.ok) throw new Error('upgrade')

// pending list for verified email
const inv = await withTx((tx) =>
  createInvitation(tx, {
    orgId: upgraded.orgId,
    email: `invitee-${stamp}@example.com`,
    role: 'member',
    invitedBy: owner,
  })
)
const pending = await listPendingInvitesWithTokensForEmail(sql, {
  email: `invitee-${stamp}@example.com`,
})
assert.equal(pending.length, 1)

const accepted = await withTx((tx) =>
  acceptInvitation(tx, {
    token: inv.token,
    userId: invitee,
    email: `invitee-${stamp}@example.com`,
    emailVerified: true,
  })
)
assert.equal(accepted.ok, true)

const mem = await sql`
  select role from memberships where org_id = ${upgraded.orgId} and user_id = ${invitee}
`
assert.equal(mem[0]?.role, 'member')

const auditInvite = await sql`
  select count(*)::int as c from audit_log where org_id = ${upgraded.orgId} and action = 'invitation.accept'
`
assert.ok(Number(auditInvite[0]?.c) >= 1)

// decline
const inv2 = await withTx((tx) =>
  createInvitation(tx, {
    orgId: upgraded.orgId,
    email: `invitee-${stamp}@example.com`,
    role: 'member',
    invitedBy: owner,
  })
)
const declined = await withTx((tx) =>
  declineInvitationById(tx, {
    invitationId: inv2.id,
    userId: invitee,
    email: `invitee-${stamp}@example.com`,
    emailVerified: true,
  })
)
assert.equal(declined.ok, true)

const wrongEmail = await withTx((tx) =>
  acceptInvitation(tx, {
    token: inv2.token,
    userId: invitee,
    email: 'other@example.com',
    emailVerified: true,
  })
)
assert.equal(wrongEmail.ok, false)

// expired
const old = await withTx((tx) =>
  createInvitation(tx, {
    orgId: upgraded.orgId,
    email: `old-${stamp}@example.com`,
    role: 'member',
    invitedBy: owner,
    expiresAt: new Date('2020-01-01T00:00:00.000Z'),
  })
)
const exp = await withTx((tx) =>
  acceptInvitation(tx, {
    token: old.token,
    userId: invitee,
    email: `old-${stamp}@example.com`,
    emailVerified: true,
    now: new Date(),
  })
)
assert.equal(exp.ok, false)
if (!exp.ok) assert.equal(exp.code, 'expired')

// accept by id from me.pendingInvites
const inv3 = await withTx((tx) =>
  createInvitation(tx, {
    orgId: upgraded.orgId,
    email: `byid-${stamp}@example.com`,
    role: 'admin',
    invitedBy: owner,
  })
)
const byId = await withTx((tx) =>
  getInvitationByIdForAccept(tx, {
    invitationId: inv3.id,
    userId: invitee,
    email: `byid-${stamp}@example.com`,
    emailVerified: true,
  })
)
assert.equal(byId.ok, true)

// join code regenerate
await withTx(async (tx) => {
  await tx`update join_codes set revoked_at = now() where org_id = ${upgraded.orgId} and revoked_at is null`
})
const code1 = await withTx((tx) => createJoinCode(tx, { orgId: upgraded.orgId, createdBy: owner }))
const code2 = await withTx((tx) =>
  regenerateJoinCode(tx, { orgId: upgraded.orgId, actorUserId: owner })
)
const badRedeem = await withTx((tx) =>
  redeemJoinCode(tx, { code: code1.code, userId: invitee })
)
assert.equal(badRedeem.ok, false)
if (!badRedeem.ok) assert.ok(['invalid_code', 'revoked'].includes(badRedeem.code))
const joiner = `j-${stamp}`
await ensureUserAndBilling(sql, joiner)
const okRedeem = await withTx((tx) => redeemJoinCode(tx, { code: code2.code, userId: joiner }))
assert.equal(okRedeem.ok, true)

// admin role on join code blocked at redeem
const outsider = `x-${stamp}`
await ensureUserAndBilling(sql, outsider)
await withTx(async (tx) => {
  await tx`update join_codes set role = 'admin' where org_id = ${upgraded.orgId} and revoked_at is null`
})
const adminRedeem = await withTx((tx) => redeemJoinCode(tx, { code: code2.code, userId: outsider }))
assert.equal(adminRedeem.ok, false)
if (!adminRedeem.ok) assert.equal(adminRedeem.code, 'invalid_role')

// upgraded cannot redeem
assert.equal(await userCannotJoinByCode(sql, owner), true)
const indiv = `ind-${stamp}`
await ensureUserAndBilling(sql, indiv)
assert.equal(await userCannotJoinByCode(sql, indiv), false)

// org invitation + acceptParent
const superUid = `s-${stamp}`
const childUid = `c-${stamp}`
await sql`insert into users (id) values (${superUid}), (${childUid}) on conflict (id) do nothing`
await ensureUserAndBilling(sql, superUid)
await ensureUserAndBilling(sql, childUid)

const superUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: superUid, name: 'Super', kind: 'super_org' })
)
assert.ok(superUp.ok)
if (!superUp.ok) throw new Error('super')

const child = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: childUid, name: 'ChildOrg' })
)
assert.ok(child.ok)
if (!child.ok) throw new Error('child')

const oi = await withTx((tx) =>
  createOrgInvitation(tx, {
    superOrgId: superUp.orgId,
    targetOrgId: child.orgId,
    invitedBy: superUid,
  })
)
assert.equal(oi.ok, true)

const second = await withTx((tx) =>
  createOrgInvitation(tx, {
    superOrgId: superUp.orgId,
    targetOrgId: child.orgId,
    invitedBy: superUid,
  })
)
assert.equal(second.ok, false)
if (!second.ok) assert.equal(second.code, 'pending_exists')

await withTx(async (tx) => {
  const pendingRow = await findPendingOrgInvitation(tx, {
    childOrgId: child.orgId,
    superOrgId: superUp.orgId,
  })
  assert.ok(pendingRow)
  const acceptedParent = await acceptParent(tx, {
    childOrgId: child.orgId,
    superOrgId: superUp.orgId,
  })
  assert.equal(acceptedParent.ok, true)
  await markOrgInvitationAccepted(tx, { invitationId: pendingRow!.id })
})

const declinedParent = await withTx((tx) =>
  declineOrgInvitation(tx, {
    childOrgId: child.orgId,
    superOrgId: superUp.orgId,
    actorUserId: childUid,
  })
)
// already accepted — decline should be not_found
assert.equal(declinedParent, 'not_found')

// createChildOrg pending owner (no membership for creator)
const childCreate = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: superUp.orgId,
    name: 'Studio',
    ownerEmail: `studio-owner-${stamp}@example.com`,
    createdBy: superUid,
  })
)
assert.ok(childCreate.ok)
if (!childCreate.ok) throw new Error('child create')
const ownerMem = await sql`
  select 1 from memberships where org_id = ${childCreate.orgId} and user_id = ${superUid} and status = 'active'
`
assert.equal(ownerMem.length, 0)

console.log('invites2bB.ledgercheck: ok')
await sql.end({ timeout: 1 })