/**
 * Named paying-account cases (header selects the org wallet) and platform-admin membership.
 * Run: DATABASE_URL=... npx tsx src/lib/orgs/payingAccountCases.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const {
  ensureUserAndBilling,
  getBillingByOrgId,
  getBillingByUserId,
  getJob,
  insertCreditTransaction,
  updateBillingById,
} = await import('@/lib/db/wallet')
const { releaseCredits, reserveCredits, OrgAccessDeniedError } = await import('@/lib/gateway/debit')
const { authorizeOrg } = await import('@/lib/orgs/authorize')
const { createChildOrg } = await import('@/lib/orgs/createChildOrg')
const { joinOrgAsMember, lookupJoinCode } = await import('@/lib/orgs/joinCodes')
const { leaveOrgAsMember, setMemberRole } = await import('@/lib/orgs/members')
const { transferCredits } = await import('@/lib/orgs/transferCredits')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')

const stamp = Date.now().toString(16)
const periodEnd = new Date(Date.now() + 30 * 864e5)
const openIds: string[] = []

async function seedPersonal(uid: string, allocation: number) {
  await ensureUserAndBilling(sql, uid)
  if (allocation <= 0) return
  await updateBillingById(sql, (await getBillingByUserId(sql, uid))!.id, {
    plan: 'pro',
    planStatus: 'active',
    currentPeriodEnd: periodEnd,
    allocationBalance: allocation,
  })
  const billing = await getBillingByUserId(sql, uid)
  await insertCreditTransaction(sql, `seed_${uid}`, billing!.id, {
    user_id: uid,
    type: 'grant',
    amount: allocation,
    bucket: 'allocation',
    reason: 'test.seed',
  })
}

async function spend(uid: string, orgPublicId: string | null, credits: number, requestedModel?: string, email?: string) {
  const requestId = `${uid}-${openIds.length}-${stamp}`
  openIds.push(requestId)
  await reserveCredits({
    uid,
    requestId,
    provider: 'openrouter',
    estimatedCredits: credits,
    orgPublicId,
    email,
    emailVerified: email ? true : undefined,
    extra: requestedModel ? { requestedModel } : undefined,
  })
  return requestId
}

// --- 1. Promoted owner of a super-org-created child (not the creator) ---
const superOwner = `pac-sup-${stamp}`
const promoted = `pac-pro-${stamp}`
await seedPersonal(superOwner, 0)
await seedPersonal(promoted, 77)
const superUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: superOwner, name: 'Case Super', kind: 'super_org' })
)
assert.ok(superUp.ok)
if (!superUp.ok) throw new Error('super')
const superBilling = await getBillingByOrgId(sql, superUp.orgId)
assert.ok(superBilling)
await updateBillingById(sql, superBilling!.id, {
  plan: 'pro',
  planStatus: 'active',
  currentPeriodEnd: periodEnd,
  topUpBalance: 5_000,
})
await insertCreditTransaction(sql, `pac_top_${stamp}`, superBilling!.id, {
  org_id: superUp.orgId,
  type: 'grant',
  amount: 5_000,
  bucket: 'top_up',
  expires_at: new Date(Date.now() + 365 * 864e5),
  reason: 'test.seed',
})
const child = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: superUp.orgId,
    name: 'Case Child',
    confirmName: 'Case Child',
    createdBy: superOwner,
  })
)
assert.ok(child.ok)
if (!child.ok) throw new Error('child')
const codeRows = await sql`
  select code from join_codes
  where org_id = ${child.orgId} and revoked_at is null
  limit 1
`
const childCode = String(codeRows[0]?.code ?? '')
assert.ok(childCode)
const joined = await withTx(async (tx) => {
  const found = await lookupJoinCode(tx, childCode)
  assert.ok(found)
  return joinOrgAsMember(tx, { orgId: found!.orgId, userId: promoted })
})
assert.equal(joined.ok, true)
const promotedRole = await withTx((tx) =>
  setMemberRole(tx, { orgId: child.orgId, userId: promoted, role: 'owner', actorUserId: superOwner })
)
assert.equal(promotedRole.ok, true)
const creatorLeft = await withTx((tx) => leaveOrgAsMember(tx, { orgId: child.orgId, userId: superOwner }))
assert.equal(creatorLeft.ok, true)
const sent = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superUp.orgId,
    toOrgId: child.orgId,
    credits: 200,
    idempotencyKey: `pac-${stamp}`,
    actorUserId: superOwner,
  })
)
assert.equal(sent.ok, true)
const audit = await sql`
  select action, metadata from audit_log
  where org_id = ${superUp.orgId} and action = 'credits.transfer'
`
assert.equal(audit.length, 1)
const case1 = await spend(promoted, child.orgPublicId, 40)
{
  const org = await getBillingByOrgId(sql, child.orgId)
  const personal = await getBillingByUserId(sql, promoted)
  assert.equal(org?.sponsoredBalance, 160)
  assert.equal(org?.allocationBalance, 0)
  assert.equal(org?.topUpBalance, 0)
  assert.equal(personal?.allocationBalance, 77)
  const job = await getJob(sql, case1)
  assert.equal(job?.billingAccountId, child.billingAccountId)
  assert.equal(job?.orgId, child.orgId)
  assert.equal(job?.heldSponsored, 40)
}

// --- 2. Creator of an independent org: plan credits, with and without the header ---
const creator = `pac-own-${stamp}`
await seedPersonal(creator, 100)
const own = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: creator, name: 'Case Own' }))
assert.ok(own.ok)
if (!own.ok) throw new Error('own')
await spend(creator, null, 25)
const withHeader = await spend(creator, own.orgPublicId, 15, 'okvevo/auto-cost')
{
  const org = await getBillingByOrgId(sql, own.orgId)
  assert.equal(org?.allocationBalance, 60)
  assert.equal(await getBillingByUserId(sql, creator), undefined)
  const job = await getJob(sql, withHeader)
  assert.equal(job?.billingAccountId, org?.id)
  assert.equal(job?.requestedModel, 'okvevo/auto-cost')
}

// --- 3. Code joiner and a member promoted to owner, independent org ---
const host = `pac-host-${stamp}`
const member = `pac-mem-${stamp}`
const madeOwner = `pac-mown-${stamp}`
await seedPersonal(host, 100)
await seedPersonal(member, 500)
await seedPersonal(madeOwner, 500)
const hostUp = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: host, name: 'Case Host' }))
assert.ok(hostUp.ok)
if (!hostUp.ok) throw new Error('host')
const hostBilling = await getBillingByOrgId(sql, hostUp.orgId)
await updateBillingById(sql, hostBilling!.id, { topUpBalance: 40 })
await insertCreditTransaction(sql, `pac_host_top_${stamp}`, hostBilling!.id, {
  org_id: hostUp.orgId,
  type: 'grant',
  amount: 40,
  bucket: 'top_up',
  reason: 'test.seed',
})
const hostCode = String(
  (await sql`
    select code from join_codes where org_id = ${hostUp.orgId} and revoked_at is null limit 1
  `)[0]?.code ?? ''
)
for (const uid of [member, madeOwner]) {
  const result = await withTx(async (tx) => {
    const found = await lookupJoinCode(tx, hostCode)
    assert.ok(found)
    return joinOrgAsMember(tx, { orgId: found!.orgId, userId: uid })
  })
  assert.equal(result.ok, true)
}
const memberAuth = await authorizeOrg(sql, {
  userId: member,
  orgPublicId: hostUp.orgPublicId,
  need: 'spend',
})
assert.equal(memberAuth.ok, true)
if (memberAuth.ok) {
  assert.equal(memberAuth.role, 'member')
  assert.equal(memberAuth.canSpend, true)
}
await spend(member, hostUp.orgPublicId, 30)
const ownerRole = await withTx((tx) =>
  setMemberRole(tx, { orgId: hostUp.orgId, userId: madeOwner, role: 'owner', actorUserId: host })
)
assert.equal(ownerRole.ok, true)
await spend(madeOwner, hostUp.orgPublicId, 80)
{
  const org = await getBillingByOrgId(sql, hostUp.orgId)
  assert.equal(org?.allocationBalance, 0)
  assert.equal(org?.topUpBalance, 30)
  assert.equal((await getBillingByUserId(sql, member))?.allocationBalance, 500)
  assert.equal((await getBillingByUserId(sql, madeOwner))?.allocationBalance, 500)
}

// --- 4. Platform admin who is a member debits the org; admin with no membership does not ---
process.env.ADMIN_EMAILS = 'platform-member@okvevo.com'
const adminMember = `pac-adm-${stamp}`
const adminOutsider = `pac-out-${stamp}`
await seedPersonal(adminMember, 9)
await ensureUserAndBilling(sql, adminOutsider)
await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${hostUp.orgId}, ${adminMember}, 'member', 'active')
`
const adminSpendAuth = await authorizeOrg(sql, {
  userId: adminMember,
  orgPublicId: hostUp.orgPublicId,
  need: 'spend',
  email: 'platform-member@okvevo.com',
  emailVerified: true,
})
assert.equal(adminSpendAuth.ok, true)
if (adminSpendAuth.ok) assert.equal(adminSpendAuth.role, 'member')
const before = (await getBillingByOrgId(sql, hostUp.orgId))!.topUpBalance
await spend(adminMember, hostUp.orgPublicId, 10, undefined, 'platform-member@okvevo.com')
assert.equal((await getBillingByOrgId(sql, hostUp.orgId))?.topUpBalance, before - 10)
assert.equal((await getBillingByUserId(sql, adminMember))?.allocationBalance, 9)

const outsiderRead = await authorizeOrg(sql, {
  userId: adminOutsider,
  orgPublicId: hostUp.orgPublicId,
  need: 'read',
  email: 'platform-member@okvevo.com',
  emailVerified: true,
})
assert.equal(outsiderRead.ok, true)
if (outsiderRead.ok) {
  assert.equal(outsiderRead.role, 'platform_admin')
  assert.equal(outsiderRead.canSpend, false)
}
const outsiderSpend = await authorizeOrg(sql, {
  userId: adminOutsider,
  orgPublicId: hostUp.orgPublicId,
  need: 'spend',
  email: 'platform-member@okvevo.com',
  emailVerified: true,
})
assert.equal(outsiderSpend.ok, false)
await assert.rejects(
  () => spend(adminOutsider, hostUp.orgPublicId, 1, undefined, 'platform-member@okvevo.com'),
  (err: unknown) => err instanceof OrgAccessDeniedError
)

for (const id of openIds) {
  await releaseCredits(id, {
    from: ['reserved', 'queued', 'dispatching', 'submitted', 'unknown'],
  })
}

console.log('payingAccountCases.ledgercheck: ok')
await sql.end({ timeout: 1 })
