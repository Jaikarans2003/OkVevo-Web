/**
 * Layer 1 PR 2b-c: dashboard helpers + admin exact credits + member usage filter.
 * Run via npm run test:ledger (picked up as *.ledgercheck.ts).
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
const {
  owedByOrganisationsTotal,
  owesCredits,
  owesPct,
  overdrawnSentence,
  transferRepayAddedSplit,
} = await import('@/lib/orgs/dashboardHelpers')
const { installFirebaseAuthMock, setFakeAuthUid } = await import('@/lib/billing/layer1Harness')

const stamp = Date.now().toString(16)
const owner = `d2bc-o-${stamp}`
const member = `d2bc-m-${stamp}`
await ensureUserAndBilling(sql, owner)
await ensureUserAndBilling(sql, member)
await sql`update users set email = ${`${owner}@example.com`} where id = ${owner}`
await sql`update users set email = ${`${member}@example.com`} where id = ${member}`

const superUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: owner, name: `Dash Super ${stamp}`, kind: 'super_org' })
)
assert.ok(superUp.ok)
if (!superUp.ok) throw new Error('super')

const dashChildName = `Dash Child ${stamp}`
const child = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: superUp.orgId,
    name: dashChildName,
    confirmName: dashChildName,
    createdBy: owner,
  })
)
assert.ok(child.ok)
if (!child.ok) throw new Error('child')

await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${superUp.orgId}, ${member}, 'member', 'active')
`

const superBilling = await getBillingByOrgId(sql, superUp.orgId)
assert.ok(superBilling)
const exp = new Date(Date.now() + 365 * 864e5)
await insertCreditTransaction(sql, `d2bcg_${stamp}`, superBilling!.id, {
  org_id: superUp.orgId,
  type: 'grant',
  amount: 2000,
  bucket: 'top_up',
  expires_at: exp,
  reason: 'seed',
})
await updateBillingById(sql, superBilling!.id, {
  topUpBalance: 2000,
  topUpReference: 2000,
  planStatus: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
})

// Child overdrawn on sponsored
await updateBillingById(sql, child.billingAccountId, {
  sponsoredBalance: -40,
  sponsoredReference: 0,
  accessMode: 'prepaid',
})

// Seed month inflows so 1.5% limit is 100 → owesPct 40
await insertCreditTransaction(sql, `d2bcin_${stamp}`, child.billingAccountId, {
  org_id: child.orgId,
  type: 'transfer_in',
  amount: 6667,
  bucket: 'sponsored',
  reason: 'seed-inflow',
})

assert.equal(owesCredits(-40), 40)
assert.equal(owesPct(-40, 100), 40)
assert.equal(owedByOrganisationsTotal([-40, -10, 5]), 50)
assert.deepEqual(transferRepayAddedSplit({ transferred: 100, debtRecovered: 40 }), {
  repaid: 40,
  added: 60,
})
assert.equal(
  overdrawnSentence(40, 'Dash Super'),
  'Overdrawn: 40% of your 1.5% limit used. Ask Dash Super for credits.'
)

const xfer = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superUp.orgId,
    toOrgId: child.orgId,
    credits: 100,
    idempotencyKey: `d2bc-xfer-${stamp}`,
    actorUserId: owner,
  })
)
assert.ok(xfer.ok)
if (!xfer.ok) throw new Error('xfer')
assert.equal(xfer.debtRecovered, 40)
assert.equal(xfer.transferred, 100)

const superPub = String(
  (await sql`select public_id from organizations where id = ${superUp.orgId}`)[0]!.public_id
)

await installFirebaseAuthMock()
const { NextRequest } = await import('next/server')
const orgRoute = await import('@/app/api/orgs/[publicId]/route')
const usageRoute = await import('@/app/api/orgs/[publicId]/usage/route')
const transfersRoute = await import('@/app/api/orgs/[publicId]/transfers/route')
const summaryRoute = await import('@/app/api/billing/summary/route')

async function getOrg(actor: string, publicId: string) {
  setFakeAuthUid(actor)
  const req = new NextRequest(`http://localhost/api/orgs/${publicId}`, {
    headers: { authorization: `Bearer ${actor}` },
  })
  const res = await orgRoute.GET(req, { params: Promise.resolve({ publicId }) })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

async function getUsage(actor: string, publicId: string) {
  setFakeAuthUid(actor)
  const req = new NextRequest(`http://localhost/api/orgs/${publicId}/usage?group_by=user`, {
    headers: { authorization: `Bearer ${actor}` },
  })
  const res = await usageRoute.GET(req, { params: Promise.resolve({ publicId }) })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

// Owner/admin exact credits on super-org GET
const ownerDash = await getOrg(owner, superPub)
assert.equal(ownerDash.status, 200)
assert.ok(ownerDash.json.exact)
const exact = ownerDash.json.exact as Record<string, unknown>
assert.equal(typeof exact.availableToSend, 'number')
assert.ok(String(exact.availableToSendLabel).includes('Available to send:'))
assert.equal(typeof exact.owedByOrganisations, 'number')
// Children moved to GET /api/orgs/:publicId/organisations (list-apis PR).
assert.equal(ownerDash.json.children, undefined)

// Member must not see exact credits; members list is self only
const memberDash = await getOrg(member, superPub)
assert.equal(memberDash.status, 200)
assert.equal(memberDash.json.exact, undefined)
const memberMembers = memberDash.json.members as Array<Record<string, unknown>>
assert.equal(memberMembers.length, 1)
assert.equal(String(memberMembers[0]!.userId), member)
assert.equal(String(memberMembers[0]!.role), 'member')
assert.equal(memberDash.json.children, undefined)

// Admin/owner sees full member list
const ownerMembers = ownerDash.json.members as Array<Record<string, unknown>>
assert.ok(ownerMembers.length >= 2)
assert.ok(ownerMembers.some((m) => String(m.userId) === owner))
assert.ok(ownerMembers.some((m) => String(m.userId) === member))

// Member usage scoped to self (usage_daily is a view over debit rows)
await insertCreditTransaction(sql, `d2bcd_o_${stamp}`, superBilling!.id, {
  org_id: superUp.orgId,
  user_id: owner,
  type: 'debit',
  amount: 50,
  bucket: 'top_up',
  reason: 'usage-seed',
})
await insertCreditTransaction(sql, `d2bcd_m_${stamp}`, superBilling!.id, {
  org_id: superUp.orgId,
  user_id: member,
  type: 'debit',
  amount: 7,
  bucket: 'top_up',
  reason: 'usage-seed',
})
const memberUsage = await getUsage(member, superPub)
assert.equal(memberUsage.status, 200)
const rows = (memberUsage.json.rows as Array<Record<string, unknown>>) ?? []
for (const r of rows) {
  assert.equal(String(r.user_id), member)
}

const ownerUsage = await getUsage(owner, superPub)
assert.equal(ownerUsage.status, 200)
const ownerRows = (ownerUsage.json.rows as Array<Record<string, unknown>>) ?? []
assert.ok(ownerRows.length >= 1)

// Transfers list (admin) includes repay/added split
setFakeAuthUid(owner)
const xferRes = await transfersRoute.GET(
  new NextRequest(`http://localhost/api/orgs/${superPub}/transfers`, {
    headers: { authorization: `Bearer ${owner}` },
  }),
  { params: Promise.resolve({ publicId: superPub }) }
)
assert.equal(xferRes.status, 200)
const xferJson = (await xferRes.json()) as { items: Array<Record<string, unknown>> }
assert.ok(xferJson.items.length >= 1)
assert.equal(typeof xferJson.items[0]!.repaid, 'number')
assert.equal(typeof xferJson.items[0]!.added, 'number')

// Member-facing billing summary stays percentages only (no raw balances)
setFakeAuthUid(member)
const summaryRes = await summaryRoute.GET(
  new NextRequest('http://localhost/api/billing/summary', {
    headers: {
      authorization: `Bearer ${member}`,
      'x-okvevo-org': superPub,
    },
  })
)
assert.equal(summaryRes.status, 200)
const summary = (await summaryRes.json()) as Record<string, unknown>
assert.equal(typeof summary.remainingPct, 'number')
assert.equal(typeof summary.sponsoredPct, 'number')
assert.equal(summary.allocationBalance, undefined)
assert.equal(summary.topUpBalance, undefined)
assert.equal(summary.sponsoredBalance, undefined)

console.log('dashboard2bC.ledgercheck: ok')
await sql.end({ timeout: 1 })
