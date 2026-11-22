/**
 * Code-join Layer 1: join route semantics not fully covered by membership.ledgercheck.
 * Run: npx tsx src/lib/orgs/codeJoin.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { ensureUserAndBilling } = await import('@/lib/db/wallet')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const { acceptParent } = await import('@/lib/orgs/acceptParent')
const {
  ensureJoinCode,
  joinOrgAsMember,
  lookupJoinCode,
  createJoinCode,
} = await import('@/lib/orgs/joinCodes')
const { authorizeOrg } = await import('@/lib/orgs/authorize')
const { leaveOrgAsMember } = await import('@/lib/orgs/members')

const stamp = Date.now().toString(16)

// --- individuals + org code → join member ---
const orgOwner = `cj-own-${stamp}`
const joiner = `cj-join-${stamp}`
await ensureUserAndBilling(sql, orgOwner)
await ensureUserAndBilling(sql, joiner)

const upgraded = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: orgOwner, name: 'CodeJoin Org', kind: 'org' })
)
assert.ok(upgraded.ok)
if (!upgraded.ok) throw new Error('upgrade')

await withTx(async (tx) => {
  await tx`update join_codes set revoked_at = now() where org_id = ${upgraded.orgId} and revoked_at is null`
})
const orgCode = await withTx((tx) =>
  createJoinCode(tx, { orgId: upgraded.orgId, createdBy: orgOwner, kind: 'org' })
)
const joined = await withTx(async (tx) => {
  const found = await lookupJoinCode(tx, orgCode.code)
  assert.ok(found)
  assert.equal(found.kind, 'org')
  return joinOrgAsMember(tx, { orgId: found.orgId, userId: joiner })
})
assert.equal(joined.ok, true)

// --- individual + super_org code → create_org_first (personal box) ---
const superApplicant = `cj-super-ind-${stamp}`
await ensureUserAndBilling(sql, superApplicant)
const superOwner = `cj-super-own-${stamp}`
await ensureUserAndBilling(sql, superOwner)

const superRows = await sql`
  insert into organizations (public_id, kind, name, created_by)
  values (${`sorg_cj_${stamp}`}, 'super_org', 'CJ Super', ${superOwner})
  returning id, public_id
`
const superOrgId = String(superRows[0]!.id)
const superOrgPublicId = String(superRows[0]!.public_id)
await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${superOrgId}, ${superOwner}, 'owner', 'active')
`
await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, plan_status,
    top_up_balance, top_up_reference, allocation_balance, credits_included, current_period_end
  ) values (
    ${superOrgId}, 'super_org', 'subscription', 'active',
    1000, 1000, 20000, 20000, ${new Date(Date.now() + 86_400_000)}
  )
`

const superCode = await withTx((tx) =>
  createJoinCode(tx, { orgId: superOrgId, createdBy: superOwner, kind: 'super_org' })
)
const personalSuper = await withTx(async (tx) => {
  const found = await lookupJoinCode(tx, superCode.code)
  assert.ok(found)
  if (found.kind === 'super_org') {
    return { ok: false as const, code: 'create_org_first' as const }
  }
  return joinOrgAsMember(tx, { orgId: found!.orgId, userId: superApplicant })
})
assert.equal(personalSuper.ok, false)
if (!personalSuper.ok) assert.equal(personalSuper.code, 'create_org_first')

// --- org owner + super code → acceptParent (header path semantics) ---
const childOwner = `cj-child-own-${stamp}`
await ensureUserAndBilling(sql, childOwner)
const childUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: childOwner, name: 'CJ Child', kind: 'org' })
)
assert.ok(childUp.ok)
if (!childUp.ok) throw new Error('child upgrade')

const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
await sql`
  update billing_accounts
  set plan_status = 'active',
      plan = 'starter',
      credits_included = 20000,
      allocation_balance = 15000,
      top_up_balance = 500,
      top_up_reference = 500,
      razorpay_subscription_id = ${`sub_cj_${stamp}`},
      current_period_end = ${periodEnd}
  where owner_org_id = ${childUp.orgId}
`

const acceptViaCode = await withTx(async (tx) => {
  const found = await lookupJoinCode(tx, superCode.code)
  assert.ok(found)
  assert.equal(found.kind, 'super_org')
  return acceptParent(tx, { childOrgId: childUp.orgId, superOrgId: found.orgId })
})
assert.equal(acceptViaCode.ok, true)

// --- inherited_read: super owner reads child; owner/spend denied ---
const childRead = await authorizeOrg(sql, {
  userId: superOwner,
  orgPublicId: childUp.orgPublicId,
  need: 'read',
})
assert.equal(childRead.ok, true)
if (childRead.ok) {
  assert.equal(childRead.role, 'inherited_read')
  assert.equal(childRead.canSpend, false)
}

const childOwnerNeed = await authorizeOrg(sql, {
  userId: superOwner,
  orgPublicId: childUp.orgPublicId,
  need: 'owner',
})
assert.equal(childOwnerNeed.ok, false)
if (!childOwnerNeed.ok) assert.equal(childOwnerNeed.code, 'org_access_denied')

const childSpend = await authorizeOrg(sql, {
  userId: superOwner,
  orgPublicId: childUp.orgPublicId,
  need: 'spend',
})
assert.equal(childSpend.ok, false)

// Direct child owner still has owner on child (sanity)
const directChild = await authorizeOrg(sql, {
  userId: childOwner,
  orgPublicId: childUp.orgPublicId,
  need: 'owner',
})
assert.equal(directChild.ok, true)
if (directChild.ok) assert.equal(directChild.role, 'owner')

// --- self-leave last_owner ---
const sole = await withTx((tx) =>
  leaveOrgAsMember(tx, { orgId: upgraded.orgId, userId: orgOwner })
)
assert.equal(sole.ok, false)
if (!sole.ok) assert.equal(sole.code, 'last_owner')

// --- ensureJoinCode returns plaintext when active code exists ---
const first = await withTx((tx) =>
  ensureJoinCode(tx, { orgId: superOrgId, createdBy: superOwner, kind: 'super_org' })
)
const second = await withTx((tx) =>
  ensureJoinCode(tx, { orgId: superOrgId, createdBy: superOwner, kind: 'super_org' })
)
assert.equal(second.created, false)
assert.equal(second.code, first.code)
assert.ok(second.code.length > 8)
assert.equal(second.code, superCode.code)

console.log('codeJoin.ledgercheck: ok')
await sql.end({ timeout: 1 })