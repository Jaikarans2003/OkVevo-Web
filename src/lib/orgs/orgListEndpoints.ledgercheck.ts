/**
 * List-apis PR: /organisations + /members list endpoints, transfers paging,
 * and the children-less org detail shape.
 * Run: npx tsx src/lib/orgs/orgListEndpoints.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:9099'

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
const { installFirebaseAuthMock, setFakeAuthUid } = await import('@/lib/billing/layer1Harness')

const stamp = Date.now().toString(16)
const owner = `ole-o-${stamp}`
const otherSuperOwner = `ole-o2-${stamp}`
const m1 = `ole-m1-${stamp}`
const m2 = `ole-m2-${stamp}`
const m3 = `ole-m3-${stamp}`
for (const uid of [owner, otherSuperOwner, m1, m2, m3]) {
  await ensureUserAndBilling(sql, uid)
}
await sql`update users set email = ${`${owner}@example.com`}, display_name = 'Ole Owner' where id = ${owner}`
await sql`update users set email = ${`${m1}@example.com`}, display_name = 'Ann One' where id = ${m1}`
await sql`update users set email = ${`${m2}@example.com`}, display_name = 'Bob Two' where id = ${m2}`
await sql`update users set email = ${`${m3}@example.com`}, display_name = 'Cat Three' where id = ${m3}`

const superUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: owner, name: `List Super ${stamp}`, kind: 'super_org' })
)
assert.ok(superUp.ok)
if (!superUp.ok) throw new Error('super')

const alphaName = `List Alpha ${stamp}`
const alpha = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: superUp.orgId,
    name: alphaName,
    confirmName: alphaName,
    createdBy: owner,
  })
)
assert.ok(alpha.ok)
if (!alpha.ok) throw new Error('alpha')

const betaName = `List Beta ${stamp}`
const beta = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: superUp.orgId,
    name: betaName,
    confirmName: betaName,
    createdBy: owner,
  })
)
assert.ok(beta.ok)
if (!beta.ok) throw new Error('beta')

// Fund the super wallet (top_up) so transfers are entitled.
const superBilling = await getBillingByOrgId(sql, superUp.orgId)
assert.ok(superBilling)
await insertCreditTransaction(sql, `oleg_${stamp}`, superBilling!.id, {
  org_id: superUp.orgId,
  type: 'grant',
  amount: 2000,
  bucket: 'top_up',
  expires_at: new Date(Date.now() + 365 * 864e5),
  reason: 'seed',
})
await updateBillingById(sql, superBilling!.id, {
  topUpBalance: 2000,
  topUpReference: 2000,
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
})

// Two outbound transfers (also the transfers-paging fixture).
const t1 = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superUp.orgId,
    toOrgId: alpha.orgId,
    credits: 100,
    idempotencyKey: `ole-a-${stamp}`,
    actorUserId: owner,
  })
)
assert.ok(t1.ok)
if (!t1.ok) throw new Error('t1')
const t2 = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superUp.orgId,
    toOrgId: beta.orgId,
    credits: 60,
    idempotencyKey: `ole-b-${stamp}`,
    actorUserId: owner,
  })
)
assert.ok(t2.ok)
if (!t2.ok) throw new Error('t2')

// Alpha: 5/100 sponsored left → wallet 5% (low). Beta: overdrawn -40.
await updateBillingById(sql, alpha.billingAccountId, { sponsoredBalance: 5 })
await updateBillingById(sql, beta.billingAccountId, { sponsoredBalance: -40, sponsoredReference: 0 })

// Memberships: alpha gets 3 extra members; m3 is also a plain member of the super;
// otherSuperOwner owns the super but never joins alpha (inherited_read case).
for (const uid of [m1, m2, m3]) {
  await sql`
    insert into memberships (org_id, user_id, role, status)
    values (${alpha.orgId}, ${uid}, 'member', 'active')
  `
}
await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${superUp.orgId}, ${m3}, 'member', 'active')
`
await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${superUp.orgId}, ${otherSuperOwner}, 'owner', 'active')
`

// Ledger: alpha active this month (95 + 7 debits, 2 refund); beta idle 31 days.
await insertCreditTransaction(sql, `oled_a_${stamp}`, alpha.billingAccountId, {
  org_id: alpha.orgId,
  user_id: owner,
  type: 'debit',
  amount: 95,
  bucket: 'sponsored',
  reason: 'usage-seed',
})
await insertCreditTransaction(sql, `oled_m2_${stamp}`, alpha.billingAccountId, {
  org_id: alpha.orgId,
  user_id: m2,
  type: 'debit',
  amount: 7,
  bucket: 'sponsored',
  reason: 'usage-seed',
})
await insertCreditTransaction(sql, `oler_a_${stamp}`, alpha.billingAccountId, {
  org_id: alpha.orgId,
  user_id: owner,
  type: 'refund',
  amount: 2,
  bucket: 'sponsored',
  reason: 'refund-seed',
})
await insertCreditTransaction(sql, `oled_b_${stamp}`, beta.billingAccountId, {
  org_id: beta.orgId,
  user_id: owner,
  type: 'debit',
  amount: 5,
  bucket: 'sponsored',
  reason: 'usage-seed',
  created_at: new Date(Date.now() - 31 * 864e5),
})

await installFirebaseAuthMock()
const { NextRequest } = await import('next/server')
const orgsRoute = await import('@/app/api/orgs/[publicId]/organisations/route')
const membersRoute = await import('@/app/api/orgs/[publicId]/members/route')
const transfersRoute = await import('@/app/api/orgs/[publicId]/transfers/route')
const orgRoute = await import('@/app/api/orgs/[publicId]/route')

const superPub = String(
  (await sql`select public_id from organizations where id = ${superUp.orgId}`)[0]!.public_id
)

type ListJson = { items?: Array<Record<string, unknown>>; nextCursor?: string | null; error?: string }

async function getOrgs(actor: string, qs = '') {
  setFakeAuthUid(actor)
  const req = new NextRequest(`http://localhost/api/orgs/${superPub}/organisations${qs}`, {
    headers: { authorization: `Bearer ${actor}` },
  })
  const res = await orgsRoute.GET(req, { params: Promise.resolve({ publicId: superPub }) })
  return { status: res.status, json: (await res.json()) as ListJson }
}

async function getMembers(actor: string, orgPublicId: string, qs = '') {
  setFakeAuthUid(actor)
  const req = new NextRequest(`http://localhost/api/orgs/${orgPublicId}/members${qs}`, {
    headers: { authorization: `Bearer ${actor}` },
  })
  const res = await membersRoute.GET(req, { params: Promise.resolve({ publicId: orgPublicId }) })
  return { status: res.status, json: (await res.json()) as ListJson }
}

async function getTransfers(actor: string, orgPublicId: string, qs = '') {
  setFakeAuthUid(actor)
  const req = new NextRequest(`http://localhost/api/orgs/${orgPublicId}/transfers${qs}`, {
    headers: { authorization: `Bearer ${actor}` },
  })
  const res = await transfersRoute.GET(req, { params: Promise.resolve({ publicId: orgPublicId }) })
  return { status: res.status, json: (await res.json()) as ListJson }
}

async function getOrg(actor: string, orgPublicId: string) {
  setFakeAuthUid(actor)
  const req = new NextRequest(`http://localhost/api/orgs/${orgPublicId}`, {
    headers: { authorization: `Bearer ${actor}` },
  })
  const res = await orgRoute.GET(req, { params: Promise.resolve({ publicId: orgPublicId }) })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

// --- 1. organisations list: row math ---------------------------------------
const all = await getOrgs(owner)
assert.equal(all.status, 200)
assert.equal(all.json.items!.length, 2)
assert.equal(all.json.nextCursor, null)
// default sort: name asc → Alpha first
assert.equal(all.json.items![0]!.publicId, alpha.orgPublicId)

const alphaRow = all.json.items!.find((r) => r.publicId === alpha.orgPublicId)!
const betaRow = all.json.items!.find((r) => r.publicId === beta.orgPublicId)!
assert.equal(alphaRow.name, alphaName)
assert.equal(alphaRow.ownerName, 'Ole Owner')
assert.equal(alphaRow.ownerEmail, `${owner}@example.com`)
assert.equal(alphaRow.memberCount, 4)
assert.equal(alphaRow.walletPct, 5)
assert.equal(alphaRow.creditsUsed, 100)
assert.equal(alphaRow.burnPerDay, 3.33)
assert.equal(alphaRow.daysLeft, 1)
assert.equal(alphaRow.owes, 0)
assert.equal(alphaRow.active, true)

assert.equal(betaRow.memberCount, 1)
assert.equal(betaRow.walletPct, 0)
assert.equal(betaRow.creditsUsed, 0)
assert.equal(betaRow.burnPerDay, 0)
assert.equal(betaRow.daysLeft, null)
assert.equal(betaRow.owes, 40)
assert.equal(betaRow.active, false)

// --- 2. health filters ------------------------------------------------------
const activeOnly = await getOrgs(owner, '?health=active')
assert.deepEqual(activeOnly.json.items!.map((r) => r.publicId), [alpha.orgPublicId])
const idleOnly = await getOrgs(owner, '?health=inactive30')
assert.deepEqual(idleOnly.json.items!.map((r) => r.publicId), [beta.orgPublicId])
const lowOnly = await getOrgs(owner, '?health=low')
assert.equal(lowOnly.json.items!.length, 2)
const odOnly = await getOrgs(owner, '?health=overdrawn')
assert.deepEqual(odOnly.json.items!.map((r) => r.publicId), [beta.orgPublicId])

// --- 3. q, sort, paging, validation, authz ----------------------------------
const qHit = await getOrgs(owner, '?q=ALPHA')
assert.deepEqual(qHit.json.items!.map((r) => r.publicId), [alpha.orgPublicId])
const byOwes = await getOrgs(owner, '?sort=owes')
assert.equal(byOwes.json.items![0]!.publicId, beta.orgPublicId)
const byWallet = await getOrgs(owner, '?sort=walletPct')
assert.equal(byWallet.json.items![0]!.publicId, beta.orgPublicId)

const op1 = await getOrgs(owner, '?limit=1')
assert.equal(op1.json.items!.length, 1)
assert.ok(op1.json.nextCursor)
const op2 = await getOrgs(owner, `?limit=1&cursor=${encodeURIComponent(op1.json.nextCursor!)}`)
assert.equal(op2.status, 200)
assert.equal(op2.json.items!.length, 1)
assert.equal(op2.json.nextCursor, null)
assert.notEqual(op1.json.items![0]!.publicId, op2.json.items![0]!.publicId)

assert.equal((await getOrgs(owner, '?sort=bogus')).status, 400)
assert.equal((await getOrgs(owner, '?health=bogus')).status, 400)
assert.equal((await getOrgs(owner, '?limit=51')).status, 400)
assert.equal((await getOrgs(owner, '?limit=0')).status, 400)
assert.equal((await getOrgs(owner, '?cursor=!!!')).status, 400)
// super member (not owner) cannot list children
assert.equal((await getOrgs(m3)).status, 403)
// a plain child org is not a super-org
{
  setFakeAuthUid(owner)
  const req = new NextRequest(`http://localhost/api/orgs/${alpha.orgPublicId}/organisations`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  const res = await orgsRoute.GET(req, { params: Promise.resolve({ publicId: alpha.orgPublicId }) })
  assert.equal(res.status, 400)
}

// --- 4. members list: rows, paging, sort, authz ------------------------------
const mp1 = await getMembers(owner, alpha.orgPublicId, '?limit=2')
assert.equal(mp1.status, 200)
assert.equal(mp1.json.items!.length, 2)
assert.ok(mp1.json.nextCursor)
// default sort: name asc → Ann One, Bob Two
assert.equal(mp1.json.items![0]!.userId, m1)
assert.equal(mp1.json.items![1]!.userId, m2)
const m2Row = mp1.json.items![1]!
assert.equal(m2Row.role, 'member')
assert.equal(m2Row.creditsUsed, 7)
assert.ok(m2Row.lastActive)

const mp2 = await getMembers(
  owner,
  alpha.orgPublicId,
  `?limit=2&cursor=${encodeURIComponent(mp1.json.nextCursor!)}`
)
assert.equal(mp2.status, 200)
assert.equal(mp2.json.items!.length, 2)
assert.equal(mp2.json.nextCursor, null)
assert.equal(mp2.json.items![0]!.userId, m3)
assert.equal(mp2.json.items![1]!.userId, owner)
const m3Row = mp2.json.items![0]!
assert.equal(m3Row.creditsUsed, 0)
assert.equal(m3Row.lastActive, null)
const ownerRow = mp2.json.items![1]!
assert.equal(ownerRow.role, 'owner')
assert.equal(ownerRow.creditsUsed, 93)
assert.ok(ownerRow.lastActive)

const byUsed = await getMembers(owner, alpha.orgPublicId, '?sort=used')
assert.equal(byUsed.json.items![0]!.userId, owner)
assert.equal(byUsed.json.items![1]!.userId, m2)
const memberQ = await getMembers(owner, alpha.orgPublicId, '?q=bob')
assert.deepEqual(memberQ.json.items!.map((r) => r.userId), [m2])

assert.equal((await getMembers(owner, alpha.orgPublicId, '?sort=bogus')).status, 400)
assert.equal((await getMembers(owner, alpha.orgPublicId, '?cursor=!!!')).status, 400)
// plain org member cannot list members
assert.equal((await getMembers(m1, alpha.orgPublicId)).status, 403)
// super-org owner without alpha membership reads via inherited_read
const inherited = await getMembers(otherSuperOwner, alpha.orgPublicId)
assert.equal(inherited.status, 200)
assert.equal(inherited.json.items!.length, 4)

// --- 5. transfers: cursor + to= filter ---------------------------------------
const tp1 = await getTransfers(owner, superPub, '?limit=1')
assert.equal(tp1.status, 200)
assert.equal(tp1.json.items!.length, 1)
assert.ok(tp1.json.nextCursor)
const tp2 = await getTransfers(owner, superPub, `?limit=1&cursor=${encodeURIComponent(tp1.json.nextCursor!)}`)
assert.equal(tp2.status, 200)
assert.equal(tp2.json.items!.length, 1)
assert.equal(tp2.json.nextCursor, null)
const seenTransferIds = new Set([tp1.json.items![0]!.id, tp2.json.items![0]!.id])
assert.equal(seenTransferIds.size, 2)

const onlyAlpha = await getTransfers(owner, superPub, `?to=${alpha.orgPublicId}`)
assert.equal(onlyAlpha.json.items!.length, 1)
assert.equal(onlyAlpha.json.items![0]!.childPublicId, alpha.orgPublicId)
assert.equal(onlyAlpha.json.items![0]!.transferred, 100)
assert.equal(onlyAlpha.json.items![0]!.repaid, 0)
assert.equal(onlyAlpha.json.items![0]!.added, 100)
const onlyBeta = await getTransfers(owner, superPub, `?to=${beta.orgPublicId}`)
assert.equal(onlyBeta.json.items!.length, 1)
assert.equal(onlyBeta.json.items![0]!.transferred, 60)
assert.equal((await getTransfers(owner, superPub, '?cursor=!!!')).status, 400)
assert.equal((await getTransfers(owner, superPub, '?limit=51')).status, 400)

// child inbound receipts still work (and carry nextCursor)
const receipts = await getTransfers(owner, alpha.orgPublicId)
assert.equal(receipts.status, 200)
assert.equal(receipts.json.items!.length, 1)
assert.equal(receipts.json.items![0]!.total, 100)
assert.equal(receipts.json.nextCursor, null)

// --- 6. org detail: children gone, exact kept --------------------------------
const detail = await getOrg(owner, superPub)
assert.equal(detail.status, 200)
assert.equal(detail.json.children, undefined)
const exact = detail.json.exact as Record<string, unknown>
assert.ok(exact)
assert.equal(exact.owedByOrganisations, 40)
const memberDetail = await getOrg(m3, superPub)
assert.equal(memberDetail.status, 200)
assert.equal(memberDetail.json.children, undefined)

console.log('orgListEndpoints.ledgercheck: ok')
await sql.end({ timeout: 1 })
