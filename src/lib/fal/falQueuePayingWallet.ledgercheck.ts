/**
 * Fal queued-job release gate follows the wallet that PAID (job.billing_account_id)
 * under the reserve eligibility rule (reserveFalRun: prepaid or entitled + paying
 * wallet plan admits) — never the caller's personal plan.
 *
 * a. Org-paid queued job + caller's personal plan cancelled (org wallet eligible)
 *    → poll does NOT release: still queued, holds intact, no ledger rows.
 * b. Personal-paid queued job + personal plan cancelled → released (existing
 *    intended behavior preserved), refund to the personal wallet.
 * c. Org-paid queued job + org wallet fails the reserve rule (plan cancelled)
 *    → released, refund to the ORG wallet.
 * d. Prepaid child org with NO plan (sponsored credits only) + member caller with
 *    NO personal plan → NOT released; when the job completes it settles on the
 *    child org's wallet (debit row billing_account_id = child wallet).
 *
 * Run: npx tsx src/lib/fal/falQueuePayingWallet.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.FAL_KEY ??= 'emulator-test-key'
// handleQueue.ts imports firebase-admin for the route entry's Auth; the emulator
// host var lets getAdminApp() init a demo app. Nothing here talks to Firestore.
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
const { handleStatus } = await import('@/lib/fal/handleQueue')
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

// --- a. Org-paid job, caller personal cancelled, org wallet eligible: keep ----
{
  const host = `qp-a-host-${stamp}`
  await ensureUserAndBilling(sql, host)
  const hostUp = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: host, name: 'QP A Org' }))
  assert.ok(hostUp.ok)
  if (!hostUp.ok) throw new Error('host')
  const orgBilling = (await getBillingByOrgId(sql, hostUp.orgId))!
  await updateBillingById(sql, orgBilling.id, {
    plan: 'pro',
    planStatus: 'active',
    currentPeriodEnd: periodEnd,
    allocationBalance: 900,
  })

  const member = `qp-a-member-${stamp}`
  await ensureUserAndBilling(sql, member)
  const memberBilling = (await getBillingByUserId(sql, member))!
  await updateBillingById(sql, memberBilling.id, {
    plan: 'starter',
    planStatus: 'cancelled',
    allocationBalance: 50,
  })
  await joinByCode(hostUp.orgId, member)

  const holdId = `qp-a-hold-${stamp}`
  await seedQueuedJob(holdId, member, orgBilling.id)
  await upsertQueue(sql, member, { running: [], queued: [holdId], queuedCount: 1, needsSubmit: false })

  const res = await handleStatus(member, holdId)
  assert.equal(res.status, 200, 'eligible paying wallet must not 403')
  const body = (await res.json()) as Record<string, unknown>
  assert.equal(body.status, 'IN_QUEUE')
  const job = await readGatewayJob(holdId)
  assert.equal(job?.status, 'queued', 'org-paid job must survive the poll')
  const queue = parseQueue(await getQueue(sql, member))
  assert.ok(queue.queued.includes(holdId), 'queue doc keeps the hold')
  assert.equal((await getBillingByOrgId(sql, hostUp.orgId))!.allocationBalance, 900, 'org hold intact')
  assert.equal((await getBillingByUserId(sql, member))!.allocationBalance, 50, 'personal wallet untouched')
  assert.equal(await ledgerRows(holdId), 0, 'no release row')
}

// --- b. Personal-paid job, personal plan cancelled: released ------------------
{
  const uid = `qp-b-${stamp}`
  await ensureUserAndBilling(sql, uid)
  const billing = (await getBillingByUserId(sql, uid))!
  await updateBillingById(sql, billing.id, {
    plan: 'starter',
    planStatus: 'cancelled',
    allocationBalance: 900,
  })

  const holdId = `qp-b-hold-${stamp}`
  await seedQueuedJob(holdId, uid, billing.id)
  await upsertQueue(sql, uid, { running: [], queued: [holdId], queuedCount: 1, needsSubmit: false })

  const res = await handleStatus(uid, holdId)
  assert.equal(res.status, 403, 'inactive paying wallet must 403')
  const job = await readGatewayJob(holdId)
  assert.equal(job?.status, 'released')
  assert.equal(job?.releaseReason, 'plan_inactive')
  assert.equal((await getBillingByUserId(sql, uid))!.allocationBalance, 1000, 'hold refunded to personal wallet')
}

// --- c. Org-paid job, org wallet fails the reserve rule: released -------------
{
  const host = `qp-c-host-${stamp}`
  await ensureUserAndBilling(sql, host)
  const hostUp = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: host, name: 'QP C Org' }))
  assert.ok(hostUp.ok)
  if (!hostUp.ok) throw new Error('host')
  const orgBilling = (await getBillingByOrgId(sql, hostUp.orgId))!
  await updateBillingById(sql, orgBilling.id, {
    plan: 'pro',
    planStatus: 'cancelled',
    allocationBalance: 900,
  })

  const member = `qp-c-member-${stamp}`
  await ensureUserAndBilling(sql, member)
  const memberBilling = (await getBillingByUserId(sql, member))!
  await updateBillingById(sql, memberBilling.id, {
    plan: 'starter',
    planStatus: 'active',
    currentPeriodEnd: periodEnd,
    allocationBalance: 50,
  })
  await joinByCode(hostUp.orgId, member)

  const holdId = `qp-c-hold-${stamp}`
  await seedQueuedJob(holdId, member, orgBilling.id)
  await upsertQueue(sql, member, { running: [], queued: [holdId], queuedCount: 1, needsSubmit: false })

  const res = await handleStatus(member, holdId)
  assert.equal(res.status, 403, 'failing paying wallet must 403 even with an active personal plan')
  const job = await readGatewayJob(holdId)
  assert.equal(job?.status, 'released')
  assert.equal(job?.releaseReason, 'plan_inactive')
  assert.equal((await getBillingByOrgId(sql, hostUp.orgId))!.allocationBalance, 1000, 'hold refunded to the ORG wallet')
  assert.equal((await getBillingByUserId(sql, member))!.allocationBalance, 50, 'personal wallet untouched')
}

// --- d. Prepaid child org (no plan, sponsored only), member with no plan ------
{
  const owner = `qp-d-sup-${stamp}`
  await ensureUserAndBilling(sql, owner)
  const up = await withTx((tx) =>
    upgradeIndividualToOrg(tx, { userId: owner, name: 'QP D Super', kind: 'super_org' })
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
  await insertCreditTransaction(sql, `qp_d_seed_${stamp}`, superBilling.id, {
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
      name: 'QP D Child',
      confirmName: 'QP D Child',
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
      idempotencyKey: `qp-d-${stamp}`,
      actorUserId: owner,
    })
  )
  assert.equal(sent.ok, true)
  const childBilling = (await getBillingByOrgId(sql, child.orgId))!
  assert.equal(childBilling.accessMode, 'prepaid')
  assert.equal(childBilling.plan, null, 'child has no plan of its own')
  // Post-hold state: 500 sponsored transferred in, 100 held by the seeded job.
  await updateBillingById(sql, childBilling.id, { sponsoredBalance: 400 })

  const member = `qp-d-member-${stamp}`
  await ensureUserAndBilling(sql, member) // blank personal wallet: no plan at all
  const joined = await withTx((tx) => joinOrgAsMember(tx, { orgId: child.orgId, userId: member }))
  assert.equal(joined.ok, true)

  const holdId = `qp-d-hold-${stamp}`
  await seedQueuedJob(holdId, member, childBilling.id, {
    heldAllocation: 0,
    heldSponsored: 100,
    orgId: child.orgId,
    superOrgId: up.orgId,
  })
  await upsertQueue(sql, member, { running: [], queued: [holdId], queuedCount: 1, needsSubmit: false })

  const res = await handleStatus(member, holdId)
  assert.equal(res.status, 200, 'prepaid child wallet is reserve-eligible without a plan')
  assert.equal((await readGatewayJob(holdId))?.status, 'queued', 'sponsored-only job must survive the poll')
  assert.equal((await getBillingByOrgId(sql, child.orgId))!.sponsoredBalance, 400, 'child hold intact')
  assert.equal(await ledgerRows(holdId), 0, 'no release row')

  // When the job completes, the settle lands on the child org's wallet.
  assert.equal(await transitionGatewayJob(holdId, ['queued'], 'dispatching'), true)
  assert.equal(await transitionGatewayJob(holdId, ['dispatching'], 'submitted'), true)
  await reconcileCredits({ requestId: holdId, actualCredits: 60, provider: 'fal', model: 'qp/test' })
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

console.log('falQueuePayingWallet.ledgercheck: ok')
await sql.end({ timeout: 1 })
