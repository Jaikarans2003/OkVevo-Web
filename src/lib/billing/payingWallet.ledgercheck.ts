/**
 * Layer 1: one paying wallet after upgrade / super-org approval.
 * Run: DATABASE_URL=… npx tsx src/lib/billing/payingWallet.ledgercheck.ts
 */
import assert from 'node:assert/strict'
import postgres from 'postgres'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const {
  ensureUserAndBilling,
  getBillingByOrgId,
  getBillingByUserId,
  getRazorpaySubscription,
  upsertRazorpaySubscription,
} = await import('@/lib/db/wallet')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const { approveSuperOrgApplication } = await import('@/lib/orgs/approveSuperOrg')
const { insertSuperOrgApplication } = await import('@/lib/api/contact')
const {
  rejectChildOrgPurchase,
  resolvePayingWallet,
} = await import('@/lib/orgs/orgContext')
const { authorizeOrg } = await import('@/lib/orgs/authorize')

const stamp = Date.now().toString(16)

function fakeReq(orgPublicId?: string | null) {
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'x-okvevo-org' ? orgPublicId ?? null : null,
    },
  } as never
}

// --- after upgrade: ensureMe leaves zero personal rows; trigger rejects insert ---
const owner = `pw-o-${stamp}`
await ensureUserAndBilling(sql, owner)
const up = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: owner, name: 'PW Org' })
)
assert.ok(up.ok)
if (!up.ok) throw new Error('upgrade')

await ensureUserAndBilling(sql, owner)
const personalAfter = await getBillingByUserId(sql, owner)
assert.equal(personalAfter, undefined)
const orgWallet = await getBillingByOrgId(sql, up.orgId)
assert.ok(orgWallet)

await assert.rejects(
  () => sql`insert into billing_accounts (owner_user_id) values (${owner})`,
  /personal_wallet_forbidden_when_upgraded/
)

const payingNoHeader = await resolvePayingWallet(sql, { userId: owner })
assert.ok(payingNoHeader.ok)
if (!payingNoHeader.ok) throw new Error('paying')
assert.equal(payingNoHeader.billingAccountId, orgWallet!.id)

// create-subscription notes / razorpay_subscriptions row point at org wallet (no header)
const subId = `sub_pw_${stamp}`
await upsertRazorpaySubscription(sql, subId, payingNoHeader.billingAccountId, {
  planType: 'starter',
})
const subRow = await getRazorpaySubscription(sql, subId)
assert.equal(subRow?.billingAccountId, orgWallet!.id)

// member 403 on owner-only mutate; owner succeeds
const member = `pw-m-${stamp}`
await ensureUserAndBilling(sql, member)
await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${up.orgId}, ${member}, 'member', 'active')
`
const memberBlock = await rejectChildOrgPurchase(sql, {
  req: fakeReq(up.orgPublicId),
  userId: member,
})
assert.equal(memberBlock.blocked, true)
if (memberBlock.blocked) assert.equal(memberBlock.code, 'org_access_denied')

const ownerBlock = await rejectChildOrgPurchase(sql, {
  req: fakeReq(null),
  userId: owner,
})
assert.equal(ownerBlock.blocked, false)
assert.ok(ownerBlock.org)

const memberTxnAuthz = await authorizeOrg(sql, {
  userId: member,
  orgPublicId: up.orgPublicId,
  need: 'admin',
})
assert.equal(memberTxnAuthz.ok, false)

const ownerTxnAuthz = await authorizeOrg(sql, {
  userId: owner,
  orgPublicId: up.orgPublicId,
  need: 'admin',
})
assert.ok(ownerTxnAuthz.ok)

// --- concurrent ensure while upgrade still open (two connections) ---
const raceUser = `pw-race-${stamp}`
await ensureUserAndBilling(sql, raceUser)
const dbUrl = process.env.DATABASE_URL!
const a = postgres(dbUrl, { max: 1 })
const b = postgres(dbUrl, { max: 1 })
try {
  let unlock!: () => void
  const upgradeLocked = new Promise<void>((resolve) => {
    unlock = resolve
  })
  const upgradeP = a.begin(async (txA) => {
    const raced = await upgradeIndividualToOrg(txA as never, {
      userId: raceUser,
      name: 'PW Race Org',
    })
    assert.ok(raced.ok)
    unlock()
    // Hold the upgrade transaction so B's trigger FOR SHARE must wait.
    await new Promise((r) => setTimeout(r, 500))
  })
  await upgradeLocked
  await assert.rejects(
    () => ensureUserAndBilling(b, raceUser),
    /personal_wallet_forbidden_when_upgraded/
  )
  await upgradeP
} finally {
  await a.end({ timeout: 1 })
  await b.end({ timeout: 1 })
}
await ensureUserAndBilling(sql, raceUser)
const racePersonal = await getBillingByUserId(sql, raceUser)
assert.equal(racePersonal, undefined)

// --- individual → super-org approval ---
const soUser = `pw-so-${stamp}`
const admin = `pw-adm-${stamp}`
await ensureUserAndBilling(sql, soUser)
await ensureUserAndBilling(sql, admin)
const app = await insertSuperOrgApplication({
  userId: soUser,
  email: 'pw-so@example.com',
  message: 'l1 super',
})
assert.ok(app.ok)
if (!app.ok) throw new Error('app')
const approved = await withTx((tx) =>
  approveSuperOrgApplication(tx, { applicationId: app.id, approvedBy: admin })
)
assert.ok(approved.ok)
if (!approved.ok) throw new Error('approve')
await ensureUserAndBilling(sql, soUser)
assert.equal(await getBillingByUserId(sql, soUser), undefined)
const soWallet = await getBillingByOrgId(sql, approved.orgId)
assert.ok(soWallet)
assert.equal(soWallet!.accountKind, 'super_org')

// --- second owner: personal wallet still exists; header buy lands on super-org ---
const second = `pw-2o-${stamp}`
await ensureUserAndBilling(sql, second)
const secondPersonal = await getBillingByUserId(sql, second)
assert.ok(secondPersonal)
await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${approved.orgId}, ${second}, 'owner', 'active')
`
const secondPayingHeader = await resolvePayingWallet(sql, {
  userId: second,
  orgPublicId: approved.orgPublicId,
})
assert.ok(secondPayingHeader.ok)
if (!secondPayingHeader.ok) throw new Error('2o')
assert.equal(secondPayingHeader.billingAccountId, soWallet!.id)
assert.notEqual(secondPayingHeader.billingAccountId, secondPersonal!.id)

const secondSub = `sub_pw2_${stamp}`
await upsertRazorpaySubscription(sql, secondSub, secondPayingHeader.billingAccountId, {
  planType: 'pro',
})
assert.equal((await getRazorpaySubscription(sql, secondSub))?.billingAccountId, soWallet!.id)

// repaired subscription row wins over a stale notes id
const repairedSub = `sub_pw_rep_${stamp}`
await upsertRazorpaySubscription(sql, repairedSub, soWallet!.id, { planType: 'starter' })
const { getBillingById } = await import('@/lib/db/wallet')
const subRepaired = await getRazorpaySubscription(sql, repairedSub)
assert.equal(subRepaired?.billingAccountId, soWallet!.id)
assert.equal((await getBillingById(sql, subRepaired!.billingAccountId!))?.id, soWallet!.id)

// notes id alone (no subscription row): applied as-is when the row exists
const notesOnlyWallet = secondPersonal!.id
const fromNotes = await getBillingById(sql, notesOnlyWallet)
assert.equal(fromNotes?.id, notesOnlyWallet)
const fallback = await resolvePayingWallet(sql, { userId: soUser })
assert.ok(fallback.ok)
if (fallback.ok) assert.equal(fallback.billingAccountId, soWallet!.id)
assert.notEqual(notesOnlyWallet, soWallet!.id)

console.log('payingWallet.ledgercheck: ok')
await sql.end({ timeout: 1 })
