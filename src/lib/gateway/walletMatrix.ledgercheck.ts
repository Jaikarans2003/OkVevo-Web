/**
 * Missing paying-wallet matrix cases (complements orgs/payingAccountCases.ledgercheck):
 * 1. Child with own plan + sponsored: reserve FIFO crosses allocation → top_up → sponsored.
 * 2. Sponsored-only child: 1.5% monthly sponsored-inflow floor (orgs/creditLimit.ts →
 *    reserve.ts splitFifo floor = -creditLimit) — exact boundary, both sides.
 * 3. Left member with the org header still set: denied, zero rows, no personal fallback.
 * 4. Settle follows job.billing_account_id (the reserve wallet), not any other wallet
 *    the caller could head at settle time; header-less reserve settles personal.
 *
 * Run: npx tsx src/lib/gateway/walletMatrix.ledgercheck.ts
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
const {
  InsufficientCreditsError,
  OrgAccessDeniedError,
  reconcileCredits,
  releaseCredits,
  reserveCredits,
} = await import('@/lib/gateway/debit')
const { authorizeOrg } = await import('@/lib/orgs/authorize')
const { createChildOrg } = await import('@/lib/orgs/createChildOrg')
const { computeCreditLimit } = await import('@/lib/orgs/creditLimit')
const { joinOrgAsMember, lookupJoinCode } = await import('@/lib/orgs/joinCodes')
const { leaveOrgAsMember } = await import('@/lib/orgs/members')
const { transferCredits } = await import('@/lib/orgs/transferCredits')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')

const stamp = Date.now().toString(16)
const periodEnd = new Date(Date.now() + 30 * 864e5)
let seq = 0

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
  await insertCreditTransaction(sql, `wm_seed_${uid}`, billing!.id, {
    user_id: uid,
    type: 'grant',
    amount: allocation,
    bucket: 'allocation',
    reason: 'test.seed',
  })
}

/** Plan-active wallet with allocation + top_up grants (does not touch sponsored). */
async function seedOrgPlanWallet(billingId: string, orgId: string, allocation: number, topUp: number) {
  await updateBillingById(sql, billingId, {
    plan: 'pro',
    planStatus: 'active',
    currentPeriodEnd: periodEnd,
    allocationBalance: allocation,
    topUpBalance: topUp,
  })
  if (allocation > 0) {
    await insertCreditTransaction(sql, `wm_a${(seq += 1)}_${stamp}`, billingId, {
      org_id: orgId,
      type: 'grant',
      amount: allocation,
      bucket: 'allocation',
      reason: 'test.seed',
    })
  }
  if (topUp > 0) {
    await insertCreditTransaction(sql, `wm_t${(seq += 1)}_${stamp}`, billingId, {
      org_id: orgId,
      type: 'grant',
      amount: topUp,
      bucket: 'top_up',
      expires_at: new Date(Date.now() + 365 * 864e5),
      reason: 'test.seed',
    })
  }
}

/** Super org (top_up funded) + prepaid child with `sponsored` transferred in. */
async function makeSuperWithChild(tag: string, sponsored: number) {
  const owner = `wm-${tag}-sup-${stamp}`
  await seedPersonal(owner, 0)
  const up = await withTx((tx) =>
    upgradeIndividualToOrg(tx, { userId: owner, name: `WM ${tag} Super`, kind: 'super_org' })
  )
  assert.ok(up.ok)
  if (!up.ok) throw new Error('super')
  const superBilling = (await getBillingByOrgId(sql, up.orgId))!
  await seedOrgPlanWallet(superBilling.id, up.orgId, 0, Math.max(5_000, sponsored))
  const child = await withTx((tx) =>
    createChildOrg(tx, {
      parentOrgId: up.orgId,
      name: `WM ${tag} Child`,
      confirmName: `WM ${tag} Child`,
      createdBy: owner,
    })
  )
  assert.ok(child.ok)
  if (!child.ok) throw new Error('child')
  const sent = await withTx((tx) =>
    transferCredits(tx, {
      fromSuperOrgId: up.orgId,
      toOrgId: child.orgId,
      credits: sponsored,
      idempotencyKey: `wm-${tag}-${stamp}`,
      actorUserId: owner,
    })
  )
  assert.equal(sent.ok, true)
  return { owner, up, child }
}

function nextRequestId(tag: string) {
  seq += 1
  return `wm-${tag}-${seq}-${stamp}`
}

/** 'tavily': no chat-concurrency gate; bucket FIFO is provider-independent. */
async function reserve(uid: string, orgPublicId: string | null, credits: number, requestId: string) {
  await reserveCredits({ uid, requestId, provider: 'tavily', estimatedCredits: credits, orgPublicId })
}

async function settle(requestId: string, credits: number) {
  await reconcileCredits({ requestId, actualCredits: credits, provider: 'tavily' })
}

type DebitRow = { id: string; billingAccountId: string; orgId: string | null; bucket: string; amount: number }
async function debitRows(requestId: string): Promise<DebitRow[]> {
  const rows = await sql`
    select id, billing_account_id, org_id, bucket, amount
    from credit_transactions
    where request_id = ${requestId} and type = 'debit'
    order by id
  `
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    billingAccountId: String(r.billing_account_id),
    orgId: (r.org_id as string | null) ?? null,
    bucket: String(r.bucket),
    amount: Number(r.amount),
  }))
}

async function countJobs(requestId: string): Promise<number> {
  const rows = await sql`select count(*)::int as c from gateway_jobs where id = ${requestId}`
  return Number(rows[0]?.c ?? 0)
}

async function countLedgerByRequest(requestId: string): Promise<number> {
  const rows = await sql`select count(*)::int as c from credit_transactions where request_id = ${requestId}`
  return Number(rows[0]?.c ?? 0)
}

async function assertChildWallet(orgId: string, want: { allocation: number; topUp: number; sponsored: number }) {
  const b = (await getBillingByOrgId(sql, orgId))!
  assert.equal(b.allocationBalance, want.allocation, 'allocationBalance')
  assert.equal(b.topUpBalance, want.topUp, 'topUpBalance')
  assert.equal(b.sponsoredBalance, want.sponsored, 'sponsoredBalance')
}

async function assertDebitBuckets(
  requestId: string,
  billingAccountId: string,
  orgId: string | null,
  want: Record<string, number>
) {
  const rows = await debitRows(requestId)
  assert.equal(rows.length, Object.keys(want).length, `debit row count for ${requestId}`)
  for (const r of rows) {
    assert.equal(r.billingAccountId, billingAccountId, 'debit billing_account_id')
    assert.equal(r.orgId, orgId, 'debit org_id')
  }
  assert.deepEqual(
    Object.fromEntries(rows.map((r) => [r.bucket, r.amount])),
    want,
    `debit bucket split for ${requestId}`
  )
}

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

// --- 1. Child with own plan AND sponsored: FIFO crosses all three buckets ---
{
  const { owner, child } = await makeSuperWithChild('c1', 200)
  const childBilling = (await getBillingByOrgId(sql, child.orgId))!
  assert.equal(childBilling.id, child.billingAccountId)
  await seedOrgPlanWallet(childBilling.id, child.orgId, 100, 50)
  await assertChildWallet(child.orgId, { allocation: 100, topUp: 50, sponsored: 200 })

  // 60 < allocation → allocation only.
  const r1 = nextRequestId('c1')
  await reserve(owner, child.orgPublicId, 60, r1)
  {
    const job = (await getJob(sql, r1))!
    assert.equal(job.billingAccountId, child.billingAccountId)
    assert.equal(job.orgId, child.orgId)
    assert.equal(job.heldAllocation, 60)
    assert.equal(job.heldTopUp, 0)
    assert.equal((job.heldSponsored as number | undefined) ?? 0, 0)
  }
  await settle(r1, 60)
  await assertChildWallet(child.orgId, { allocation: 40, topUp: 50, sponsored: 200 })
  await assertDebitBuckets(r1, child.billingAccountId, child.orgId, { allocation: 60 })

  // 70 > remaining allocation 40 → crosses into top_up.
  const r2 = nextRequestId('c1')
  await reserve(owner, child.orgPublicId, 70, r2)
  {
    const job = (await getJob(sql, r2))!
    assert.equal(job.heldAllocation, 40)
    assert.equal(job.heldTopUp, 30)
    assert.equal((job.heldSponsored as number | undefined) ?? 0, 0)
  }
  await settle(r2, 70)
  await assertChildWallet(child.orgId, { allocation: 0, topUp: 20, sponsored: 200 })
  await assertDebitBuckets(r2, child.billingAccountId, child.orgId, { allocation: 40, top_up: 30 })

  // 100 > remaining top_up 20 → crosses into sponsored.
  const r3 = nextRequestId('c1')
  await reserve(owner, child.orgPublicId, 100, r3)
  {
    const job = (await getJob(sql, r3))!
    assert.equal(job.heldAllocation, 0)
    assert.equal(job.heldTopUp, 20)
    assert.equal(job.heldSponsored, 80)
  }
  await settle(r3, 100)
  await assertChildWallet(child.orgId, { allocation: 0, topUp: 0, sponsored: 120 })
  await assertDebitBuckets(r3, child.billingAccountId, child.orgId, { top_up: 20, sponsored: 80 })
}

// --- 2. Sponsored-only child: 1.5% floor is exact ---------------------------
// Contract: orgs/creditLimit.ts computeCreditLimit = floor(1.5% of this month's
// sponsored transfer_in + debt_recovery) for prepaid wallets; reserve.ts
// splitFifo lets sponsored drop to exactly -creditLimit (floor), no further.
{
  const { owner, child } = await makeSuperWithChild('c2', 1_000)
  // 1.5% of 1000 sponsored inflow this month → 15.
  assert.equal(await computeCreditLimit(sql, child.billingAccountId), 15)

  // One credit past 1000 + 15 floor → denied, and the tx leaves zero rows.
  const over = nextRequestId('c2')
  await assert.rejects(
    () => reserve(owner, child.orgPublicId, 1_016, over),
    (err: unknown) => err instanceof InsufficientCreditsError
  )
  assert.equal(await countJobs(over), 0)
  assert.equal(await countLedgerByRequest(over), 0)

  // Exactly 1000 + 15 → admitted; sponsored lands on the floor at -15.
  const exact = nextRequestId('c2')
  await reserve(owner, child.orgPublicId, 1_015, exact)
  {
    const b = (await getBillingByOrgId(sql, child.orgId))!
    assert.equal(b.sponsoredBalance, -15)
    const job = (await getJob(sql, exact))!
    assert.equal(job.heldAllocation, 0)
    assert.equal(job.heldTopUp, 0)
    assert.equal(job.heldSponsored, 1_015)
  }

  // At the floor, one more credit is denied (available = sponsored - floor = 0).
  const beyond = nextRequestId('c2')
  await assert.rejects(
    () => reserve(owner, child.orgPublicId, 1, beyond),
    (err: unknown) => err instanceof InsufficientCreditsError
  )
  assert.equal(await countJobs(beyond), 0)
  assert.equal(await countLedgerByRequest(beyond), 0)

  await releaseCredits(exact)
  assert.equal((await getBillingByOrgId(sql, child.orgId))!.sponsoredBalance, 1_000)
}

// --- 3. Left member with the header still set: denied, no side effects ------
{
  const host = `wm-c3-host-${stamp}`
  await seedPersonal(host, 100)
  const hostUp = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: host, name: 'WM C3 Host' }))
  assert.ok(hostUp.ok)
  if (!hostUp.ok) throw new Error('host')
  const leaver = `wm-c3-leaver-${stamp}`
  await seedPersonal(leaver, 30)
  await joinByCode(hostUp.orgId, leaver)
  const left = await withTx((tx) => leaveOrgAsMember(tx, { orgId: hostUp.orgId, userId: leaver }))
  assert.equal(left.ok, true)

  const auth = await authorizeOrg(sql, { userId: leaver, orgPublicId: hostUp.orgPublicId, need: 'spend' })
  assert.equal(auth.ok, false)

  const req = nextRequestId('c3')
  await assert.rejects(
    () => reserve(leaver, hostUp.orgPublicId, 5, req),
    (err: unknown) => err instanceof OrgAccessDeniedError
  )
  assert.equal(await countJobs(req), 0)
  assert.equal(await countLedgerByRequest(req), 0)
  // Denied header must never fall back to the personal wallet.
  assert.equal((await getBillingByUserId(sql, leaver))!.allocationBalance, 30)
}

// --- 4. Settle follows job.billing_account_id -------------------------------
{
  // userA owns org A and holds spend rights on org B — B is the plausible
  // "changed header"; settle must still write to the wallet stamped at reserve.
  const userA = `wm-c4-a-${stamp}`
  await seedPersonal(userA, 100)
  const upA = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: userA, name: 'WM C4 A' }))
  assert.ok(upA.ok)
  if (!upA.ok) throw new Error('A')
  const billingA = (await getBillingByOrgId(sql, upA.orgId))!
  const hostB = `wm-c4-b-${stamp}`
  await seedPersonal(hostB, 100)
  const upB = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: hostB, name: 'WM C4 B' }))
  assert.ok(upB.ok)
  if (!upB.ok) throw new Error('B')
  const billingB = (await getBillingByOrgId(sql, upB.orgId))!
  await joinByCode(upB.orgId, userA)

  // Reserve with the A header → settle writes A's wallet; B untouched.
  const rA = nextRequestId('c4')
  await reserve(userA, upA.orgPublicId, 30, rA)
  assert.equal((await getJob(sql, rA))!.billingAccountId, billingA.id)
  await settle(rA, 30)
  assert.equal((await getBillingByOrgId(sql, upA.orgId))!.allocationBalance, 70)
  assert.equal((await getBillingByOrgId(sql, upB.orgId))!.allocationBalance, 100)
  await assertDebitBuckets(rA, billingA.id, upA.orgId, { allocation: 30 })

  // Mirror: reserve with the B header → settle writes B's wallet; A untouched.
  const rB = nextRequestId('c4')
  await reserve(userA, upB.orgPublicId, 25, rB)
  assert.equal((await getJob(sql, rB))!.billingAccountId, billingB.id)
  await settle(rB, 25)
  assert.equal((await getBillingByOrgId(sql, upB.orgId))!.allocationBalance, 75)
  assert.equal((await getBillingByOrgId(sql, upA.orgId))!.allocationBalance, 70)
  await assertDebitBuckets(rB, billingB.id, upB.orgId, { allocation: 25 })

  // No header, non-upgraded user → settle writes the personal wallet (org_id null).
  const userP = `wm-c4-p-${stamp}`
  await seedPersonal(userP, 50)
  const rP = nextRequestId('c4')
  await reserve(userP, null, 20, rP)
  const personal = (await getBillingByUserId(sql, userP))!
  assert.equal((await getJob(sql, rP))!.billingAccountId, personal.id)
  await settle(rP, 20)
  assert.equal((await getBillingByUserId(sql, userP))!.allocationBalance, 30)
  await assertDebitBuckets(rP, personal.id, null, { allocation: 20 })
}

console.log('walletMatrix.ledgercheck: ok')
await sql.end({ timeout: 1 })
