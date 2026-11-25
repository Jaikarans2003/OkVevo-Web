/**
 * Fal dispatch-sweep release gate + slot admission follow the wallet that PAID
 * (job.billing_account_id) under the reserve eligibility rule (reserveFalRun:
 * prepaid or entitled + paying-wallet plan admits; prepaid child orgs ride the
 * super-org plan) — never the caller's personal plan. Per job, never a
 * per-user mass release; each refund returns to the wallet that paid.
 *
 * a. Org-paid queued job + caller's personal plan inactive (org wallet
 *    eligible) → sweep does NOT release: still queued, holds intact, no ledger rows.
 * b. Prepaid child org with NO plan (sponsored credits only) + member caller
 *    with NO personal plan → NOT released; the job then dispatches (admitted
 *    by the child wallet riding the super-org plan) and settles on the CHILD
 *    wallet (settle debit row billing_account_id = child wallet, bucket sponsored).
 * c. Personal-paid queued job + personal plan inactive → released per job,
 *    refund to the personal wallet.
 * d. Same user holds ONE personal and ONE org queued hold, personal plan
 *    inactive → only the personal hold is released; the org hold stays queued
 *    with holds intact.
 *
 * Run: npx tsx src/lib/fal/falDispatchPayingWallet.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.FAL_KEY ??= 'emulator-test-key'
// dispatch.ts ↔ handleQueue.ts pull in firebase-admin for the route entry's
// Auth; the emulator host var lets getAdminApp() init a demo app. Nothing here
// talks to Firestore.
process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:0'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const {
  ensureUserAndBilling,
  getBillingByOrgId,
  getBillingByUserId,
  insertCreditTransaction,
  insertJob,
  updateBillingById,
} = await import('@/lib/db/wallet')
const {
  getQueue,
  readGatewayJob,
  reconcileCredits,
  transitionGatewayJob,
  upsertQueue,
} = await import('@/lib/gateway/debit')
const { parseQueue } = await import('@/lib/fal/falQueue')
const { releaseInactiveQueued, takeNextQueued } = await import('@/lib/fal/dispatch')
const { joinOrgAsMember, lookupJoinCode } = await import('@/lib/orgs/joinCodes')
const { createChildOrg } = await import('@/lib/orgs/createChildOrg')
const { transferCredits } = await import('@/lib/orgs/transferCredits')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')

const stamp = Date.now().toString(16)
const periodEnd = new Date(Date.now() + 30 * 864e5)

async function joinByCode(orgId: string, userId: string) {
  const code = String(
    (await sql`select code from join_codes where org_id = ${orgId} and revoked_at is null limit 1`)[0]
      ?.code ?? ''
  )
  assert.ok(code)
  const joined = await withTx(async (tx) => {
    const found = await lookupJoinCode(tx, code)
    assert.ok(found)
    return joinOrgAsMember(tx, { orgId: found!.orgId, userId })
  })
  assert.equal(joined.ok, true)
}

async function ledgerRows(requestId: string): Promise<number> {
  const rows = await sql`select count(*)::int as c from credit_transactions where request_id = ${requestId}`
  return Number(rows[0]?.c ?? 0)
}

function seedQueuedJob(holdId: string, uid: string, billingAccountId: string, extra?: Record<string, unknown>) {
  return insertJob(sql, holdId, uid, billingAccountId, {
    provider: 'fal',
    estimatedCredits: 100,
    heldAllocation: 100,
    heldTopUp: 0,
    status: 'queued',
    runId: `run-${holdId}`,
    ...extra,
  })
}

// --- a. Org-paid job, caller personal plan inactive, org wallet eligible: keep
{
  const host = `dp-a-host-${stamp}`
  await ensureUserAndBilling(sql, host)
  const hostUp = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: host, name: 'DP A Org' }))
  assert.ok(hostUp.ok)
  if (!hostUp.ok) throw new Error('host')
  const orgBilling = (await getBillingByOrgId(sql, hostUp.orgId))!
  await updateBillingById(sql, orgBilling.id, {
    plan: 'pro',
    planStatus: 'active',
    currentPeriodEnd: periodEnd,
    allocationBalance: 900,
  })

  const member = `dp-a-member-${stamp}`
  await ensureUserAndBilling(sql, member)
  const memberBilling = (await getBillingByUserId(sql, member))!
  await updateBillingById(sql, memberBilling.id, {
    plan: 'starter',
    planStatus: 'cancelled',
    allocationBalance: 50,
  })
  await joinByCode(hostUp.orgId, member)

  const holdId = `dp-a-hold-${stamp}`
  await seedQueuedJob(holdId, member, orgBilling.id)
  await upsertQueue(sql, member, { running: [], queued: [holdId], queuedCount: 1, needsSubmit: false })

  const released = await releaseInactiveQueued(member)
  assert.equal(released, 0, 'eligible paying wallet must not be swept')
  const job = await readGatewayJob(holdId)
  assert.equal(job?.status, 'queued', 'org-paid job must survive the sweep')
  assert.equal(job?.heldAllocation, 100, 'org-paid hold intact')
  const queue = parseQueue(await getQueue(sql, member))
  assert.ok(queue.queued.includes(holdId), 'queue doc keeps the hold')
  assert.equal((await getBillingByOrgId(sql, hostUp.orgId))!.allocationBalance, 900, 'org wallet untouched')
  assert.equal((await getBillingByUserId(sql, member))!.allocationBalance, 50, 'personal wallet untouched')
  assert.equal(await ledgerRows(holdId), 0, 'no release row')
}

// --- b. Sponsored-only prepaid child org: kept, dispatches, settles on child
{
  const owner = `dp-b-sup-${stamp}`
  await ensureUserAndBilling(sql, owner)
  const up = await withTx((tx) =>
    upgradeIndividualToOrg(tx, { userId: owner, name: 'DP B Super', kind: 'super_org' })
  )
  assert.ok(up.ok)
  if (!up.ok) throw new Error('super')
  const superBilling = (await getBillingByOrgId(sql, up.orgId))!
  await updateBillingById(sql, superBilling.id, {
    plan: 'pro',
    planStatus: 'active',
    currentPeriodEnd: periodEnd,
    topUpBalance: 5_000,
  })
  // Transfers draw from top_up inflow lots (FIFO) — seed the grant row too.
  await insertCreditTransaction(sql, `dp_b_seed_${stamp}`, superBilling.id, {
    org_id: up.orgId,
    type: 'grant',
    amount: 5_000,
    bucket: 'top_up',
    expires_at: new Date(Date.now() + 365 * 864e5),
    reason: 'test.seed',
  })
  const child = await withTx((tx) =>
    createChildOrg(tx, {
      parentOrgId: up.orgId,
      name: 'DP B Child',
      confirmName: 'DP B Child',
      createdBy: owner,
    })
  )
  assert.ok(child.ok)
  if (!child.ok) throw new Error('child')
  const sent = await withTx((tx) =>
    transferCredits(tx, {
      fromSuperOrgId: up.orgId,
      toOrgId: child.orgId,
      credits: 500,
      idempotencyKey: `dp-b-${stamp}`,
      actorUserId: owner,
    })
  )
  assert.equal(sent.ok, true)
  const childBilling = (await getBillingByOrgId(sql, child.orgId))!
  assert.equal(childBilling.accessMode, 'prepaid')
  assert.equal(childBilling.plan, null, 'child has no plan of its own')
  // Post-hold state: 500 sponsored transferred in, 100 held by the seeded job.
  await updateBillingById(sql, childBilling.id, { sponsoredBalance: 400 })

  const member = `dp-b-member-${stamp}`
  await ensureUserAndBilling(sql, member) // blank personal wallet: no plan at all
  const joined = await withTx((tx) => joinOrgAsMember(tx, { orgId: child.orgId, userId: member }))
  assert.equal(joined.ok, true)

  const holdId = `dp-b-hold-${stamp}`
  await seedQueuedJob(holdId, member, childBilling.id, {
    heldAllocation: 0,
    heldSponsored: 100,
    orgId: child.orgId,
    superOrgId: up.orgId,
  })
  await upsertQueue(sql, member, { running: [], queued: [holdId], queuedCount: 1, needsSubmit: true })

  const released = await releaseInactiveQueued(member)
  assert.equal(released, 0, 'prepaid child wallet is reserve-eligible without a plan')
  assert.equal((await readGatewayJob(holdId))?.status, 'queued', 'sponsored-only job must survive the sweep')
  assert.equal((await getBillingByOrgId(sql, child.orgId))!.sponsoredBalance, 400, 'child hold intact')
  assert.equal(await ledgerRows(holdId), 0, 'no release row')

  // Dispatch-side admission: the child wallet (riding the super-org plan)
  // admits the queued job even though the caller has no personal plan at all.
  const taken = await takeNextQueued(member)
  assert.deepEqual(taken, { holdId, runId: `run-${holdId}` }, 'child-wallet plan admits the queued job')
  assert.equal((await readGatewayJob(holdId))?.status, 'dispatching')
  const queueAfterDispatch = parseQueue(await getQueue(sql, member))
  assert.ok(queueAfterDispatch.running.includes(holdId), 'promoted into a running slot')
  assert.equal(queueAfterDispatch.queued.length, 0)

  // When the job completes, the settle lands on the child org's wallet.
  assert.equal(await transitionGatewayJob(holdId, ['dispatching'], 'submitted'), true)
  await reconcileCredits({ requestId: holdId, actualCredits: 60, provider: 'fal', model: 'dp/test' })
  assert.equal((await readGatewayJob(holdId))?.status, 'settled')
  assert.equal((await getBillingByOrgId(sql, child.orgId))!.sponsoredBalance, 440, 'child wallet charged 60')
  const debits = await sql`
    select billing_account_id, bucket, amount from credit_transactions
    where request_id = ${holdId} and type = 'debit'
  `
  assert.equal(debits.length, 1)
  assert.equal(String(debits[0]!.billing_account_id), childBilling.id, 'settle targets the child wallet')
  assert.equal(String(debits[0]!.bucket), 'sponsored')
  assert.equal(Number(debits[0]!.amount), 60)
  const memberPersonal = (await getBillingByUserId(sql, member))!
  assert.equal(memberPersonal.allocationBalance, 0, 'member personal wallet untouched')
  assert.equal(memberPersonal.topUpBalance, 0)
}

// --- c. Personal-paid job, personal plan inactive: released per job ---------
{
  const uid = `dp-c-${stamp}`
  await ensureUserAndBilling(sql, uid)
  const billing = (await getBillingByUserId(sql, uid))!
  await updateBillingById(sql, billing.id, {
    plan: 'starter',
    planStatus: 'cancelled',
    allocationBalance: 900,
  })

  const holdId = `dp-c-hold-${stamp}`
  await seedQueuedJob(holdId, uid, billing.id)
  await upsertQueue(sql, uid, { running: [], queued: [holdId], queuedCount: 1, needsSubmit: false })

  const released = await releaseInactiveQueued(uid)
  assert.equal(released, 1, 'inactive paying wallet is still swept, per job')
  const job = await readGatewayJob(holdId)
  assert.equal(job?.status, 'released')
  assert.equal(job?.releaseReason, 'plan_inactive')
  assert.equal((await getBillingByUserId(sql, uid))!.allocationBalance, 1000, 'hold refunded to personal wallet')
  const queue = parseQueue(await getQueue(sql, uid))
  assert.deepEqual(queue.queued, [], 'queue doc drops the released hold')
}

// --- d. One personal + one org hold, personal plan inactive: personal only --
{
  const host = `dp-d-host-${stamp}`
  await ensureUserAndBilling(sql, host)
  const hostUp = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: host, name: 'DP D Org' }))
  assert.ok(hostUp.ok)
  if (!hostUp.ok) throw new Error('host')
  const orgBilling = (await getBillingByOrgId(sql, hostUp.orgId))!
  await updateBillingById(sql, orgBilling.id, {
    plan: 'pro',
    planStatus: 'active',
    currentPeriodEnd: periodEnd,
    allocationBalance: 900,
  })

  const member = `dp-d-member-${stamp}`
  await ensureUserAndBilling(sql, member)
  const memberBilling = (await getBillingByUserId(sql, member))!
  await updateBillingById(sql, memberBilling.id, {
    plan: 'starter',
    planStatus: 'cancelled',
    allocationBalance: 50,
  })
  await joinByCode(hostUp.orgId, member)

  const personalHold = `dp-d-personal-${stamp}`
  const orgHold = `dp-d-org-${stamp}`
  await seedQueuedJob(personalHold, member, memberBilling.id)
  await seedQueuedJob(orgHold, member, orgBilling.id)
  await upsertQueue(sql, member, {
    running: [],
    queued: [personalHold, orgHold],
    queuedCount: 2,
    needsSubmit: false,
  })

  const released = await releaseInactiveQueued(member)
  assert.equal(released, 1, 'only the personal-paid hold is swept')
  const personalJob = await readGatewayJob(personalHold)
  assert.equal(personalJob?.status, 'released')
  assert.equal(personalJob?.releaseReason, 'plan_inactive')
  assert.equal((await getBillingByUserId(sql, member))!.allocationBalance, 150, 'personal hold refunded to personal wallet')
  const orgJob = await readGatewayJob(orgHold)
  assert.equal(orgJob?.status, 'queued', 'org-paid hold stays queued')
  assert.equal(orgJob?.heldAllocation, 100, 'org-paid hold intact')
  assert.equal((await getBillingByOrgId(sql, hostUp.orgId))!.allocationBalance, 900, 'org wallet untouched')
  const queue = parseQueue(await getQueue(sql, member))
  assert.deepEqual(queue.queued, [orgHold], 'queue doc keeps only the org hold')
  assert.equal(await ledgerRows(orgHold), 0, 'no release row for the org hold')
}

console.log('falDispatchPayingWallet.ledgercheck: ok')
await sql.end({ timeout: 1 })
