/**
 * Org-aware spend path (plan §3.4 / §5.1 / §5.2 / test 1).
 * Run: DATABASE_URL=... npx tsx src/lib/gateway/orgSpend.ledgercheck.ts
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
  updateBillingByUserId,
} = await import('@/lib/db/wallet')
const { findLedgerMismatches } = await import('@/lib/billing/ledgerInvariant')
const {
  InsufficientCreditsError,
  OrgAccessDeniedError,
  releaseCredits,
  reserveCredits,
} = await import('@/lib/gateway/debit')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const { createChildOrg } = await import('@/lib/orgs/createChildOrg')
const { transferCredits } = await import('@/lib/orgs/transferCredits')

const stamp = Date.now().toString(16)
const periodEnd = new Date(Date.now() + 30 * 864e5)

async function seedEntitledPersonal(uid: string, balances: {
  allocation?: number
  topUp?: number
}) {
  await ensureUserAndBilling(sql, uid)
  const alloc = balances.allocation ?? 0
  const topUp = balances.topUp ?? 0
  await updateBillingByUserId(sql, uid, {
    plan: 'pro',
    planStatus: 'active',
    currentPeriodEnd: periodEnd,
    allocationBalance: alloc,
    topUpBalance: topUp,
  })
  const billing = await getBillingByUserId(sql, uid)
  if (alloc > 0) {
    await insertCreditTransaction(sql, `seed_alloc_${uid}`, billing!.id, {
      user_id: uid,
      type: 'grant',
      amount: alloc,
      bucket: 'allocation',
      reason: 'test.seed',
    })
  }
  if (topUp > 0) {
    await insertCreditTransaction(sql, `seed_top_${uid}`, billing!.id, {
      user_id: uid,
      type: 'grant',
      amount: topUp,
      bucket: 'top_up',
      reason: 'test.seed',
      expires_at: new Date(Date.now() + 365 * 864e5),
    })
  }
}

// --- Individual never below 0 ---
const ind = `osp-ind-${stamp}`
await seedEntitledPersonal(ind, { allocation: 100, topUp: 50 })
await reserveCredits({
  uid: ind,
  requestId: `${ind}-ok`,
  provider: 'openrouter',
  estimatedCredits: 120,
})
{
  const b = await getBillingByUserId(sql, ind)
  assert.equal(b?.allocationBalance, 0)
  assert.equal(b?.topUpBalance, 30)
  assert.ok((b?.topUpBalance ?? 0) >= 0)
}
await assert.rejects(
  () =>
    reserveCredits({
      uid: ind,
      requestId: `${ind}-over`,
      provider: 'openrouter',
      estimatedCredits: 10_000,
    }),
  (err: unknown) => err instanceof InsufficientCreditsError
)
{
  const b = await getBillingByUserId(sql, ind)
  assert.ok((b?.topUpBalance ?? 0) >= 0)
  assert.ok((b?.allocationBalance ?? 0) >= 0)
}

// --- Upgraded user can chat right after upgrading (no X-OkVevo-Org) ---
const upg = `osp-upg-${stamp}`
await seedEntitledPersonal(upg, { allocation: 500, topUp: 0 })
const upgraded = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: upg, name: 'Spend Up Org' })
)
assert.ok(upgraded.ok)
if (!upgraded.ok) throw new Error('upgrade')
await reserveCredits({
  uid: upg,
  requestId: `${upg}-chat`,
  provider: 'openrouter',
  estimatedCredits: 40,
})
{
  const personal = await getBillingByUserId(sql, upg)
  assert.equal(personal, undefined) // owner_user_id cleared
  const orgBilling = await getBillingByOrgId(sql, upgraded.orgId)
  assert.equal(orgBilling?.allocationBalance, 460)
  assert.ok((orgBilling?.topUpBalance ?? 0) >= 0)
  const job = await getJob(sql, `${upg}-chat`)
  assert.equal(job?.billingAccountId, orgBilling?.id)
  assert.equal(job?.orgId, upgraded.orgId)
}

// --- Super-org never below 0 ---
const superOwner = `osp-sup-${stamp}`
await seedEntitledPersonal(superOwner, { allocation: 200, topUp: 100 })
const superUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, {
    userId: superOwner,
    name: 'Spend Super',
    kind: 'super_org',
  })
)
assert.ok(superUp.ok)
if (!superUp.ok) throw new Error('super')
await reserveCredits({
  uid: superOwner,
  requestId: `${superOwner}-ok`,
  provider: 'openrouter',
  estimatedCredits: 250,
})
{
  const b = await getBillingByOrgId(sql, superUp.orgId)
  assert.equal(b?.allocationBalance, 0)
  assert.equal(b?.topUpBalance, 50)
  assert.ok((b?.topUpBalance ?? 0) >= 0)
}
await assert.rejects(
  () =>
    reserveCredits({
      uid: superOwner,
      requestId: `${superOwner}-over`,
      provider: 'openrouter',
      estimatedCredits: 10_000,
    }),
  (err: unknown) => err instanceof InsufficientCreditsError
)
{
  const b = await getBillingByOrgId(sql, superUp.orgId)
  assert.ok((b?.topUpBalance ?? 0) >= 0)
}

// --- Child org: transfer 1_000_000, creditLimit 15_000, 50 concurrent reserves ---
const childOwner = `osp-ch-${stamp}`
await seedEntitledPersonal(childOwner, { allocation: 0, topUp: 0 })
const childSuper = await withTx((tx) =>
  upgradeIndividualToOrg(tx, {
    userId: childOwner,
    name: 'Limit Super',
    kind: 'super_org',
  })
)
assert.ok(childSuper.ok)
if (!childSuper.ok) throw new Error('childSuper')
const child = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: childSuper.orgId,
    name: 'Limit Child',
    ownerUserId: childOwner,
  })
)
assert.ok(child.ok)
if (!child.ok) throw new Error('child')

const superBilling = await getBillingByOrgId(sql, childSuper.orgId)
assert.ok(superBilling)
const exp = new Date(Date.now() + 365 * 864e5)
await insertCreditTransaction(sql, `osp_g_${stamp}`, superBilling!.id, {
  org_id: childSuper.orgId,
  type: 'grant',
  amount: 1_000_000,
  bucket: 'top_up',
  expires_at: exp,
  reason: 'seed',
})
await updateBillingById(sql, superBilling!.id, {
  topUpBalance: 1_000_000,
  topUpReference: 1_000_000,
  planStatus: 'active',
  currentPeriodEnd: periodEnd,
})
const xfer = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: childSuper.orgId,
    toOrgId: child.orgId,
    credits: 1_000_000,
    idempotencyKey: `osp-${stamp}`,
    actorUserId: childOwner,
  })
)
assert.ok(xfer.ok)
if (!xfer.ok) throw new Error('unreachable')

// Spend the full transfer via a ledger debit so balance is 0 while
// creditLimit still sees 1_000_000 received this month.
await insertCreditTransaction(sql, `osp_burn_${stamp}`, child.billingAccountId, {
  user_id: childOwner,
  org_id: child.orgId,
  super_org_id: childSuper.orgId,
  type: 'debit',
  amount: 1_000_000,
  bucket: 'sponsored',
  reason: 'test.burn',
})
await updateBillingById(sql, child.billingAccountId, {
  allocationBalance: 0,
  topUpBalance: 0,
  sponsoredBalance: 0,
})

// tavily skips chat-slot concurrency so this isolates the creditLimit floor.
const results = await Promise.allSettled(
  Array.from({ length: 50 }, (_, i) =>
    reserveCredits({
      uid: childOwner,
      requestId: `${childOwner}-c${i}`,
      provider: 'tavily',
      estimatedCredits: 1000,
      orgPublicId: child.orgPublicId,
    })
  )
)
const okCount = results.filter((r) => r.status === 'fulfilled').length
const failCount = results.filter((r) => r.status === 'rejected').length
assert.equal(okCount + failCount, 50)
assert.ok(okCount <= 15, `expected ≤15 admits, got ${okCount}`)
assert.ok(failCount >= 35, `expected ≥35 denials, got ${failCount}`)
{
  const b = await getBillingByOrgId(sql, child.orgId)
  assert.ok(b)
  assert.ok(
    (b!.sponsoredBalance ?? 0) >= -15_000,
    `child went below -15000: ${b!.sponsoredBalance}`
  )
  assert.equal(b!.sponsoredBalance, -okCount * 1000)
}

// X-OkVevo-Org selects the child wallet
{
  const job = await getJob(sql, `${childOwner}-c0`)
  if (okCount > 0) {
    assert.equal(job?.billingAccountId, child.billingAccountId)
    assert.equal(job?.orgId, child.orgId)
    assert.equal(job?.superOrgId, childSuper.orgId)
  }
}

// Removed member → 403 org_access_denied
const stranger = `osp-str-${stamp}`
await seedEntitledPersonal(stranger, { allocation: 1000, topUp: 0 })
await assert.rejects(
  () =>
    reserveCredits({
      uid: stranger,
      requestId: `${stranger}-deny`,
      provider: 'openrouter',
      estimatedCredits: 10,
      orgPublicId: child.orgPublicId,
    }),
  (err: unknown) =>
    err instanceof OrgAccessDeniedError && err.code === 'org_access_denied'
)
await sql`
  update memberships
  set status = 'removed'
  where org_id = ${child.orgId} and user_id = ${childOwner}
`
await assert.rejects(
  () =>
    reserveCredits({
      uid: childOwner,
      requestId: `${childOwner}-removed`,
      provider: 'openrouter',
      estimatedCredits: 10,
      orgPublicId: child.orgPublicId,
    }),
  (err: unknown) =>
    err instanceof OrgAccessDeniedError && err.code === 'org_access_denied'
)

// Release open holds so the nightly invariant (ledger − holds == cached) is clean.
const openJobs = await sql`
  select id from gateway_jobs
  where user_id in (${ind}, ${upg}, ${superOwner}, ${childOwner})
    and status in ('reserved', 'queued', 'dispatching', 'submitted', 'unknown')
`
for (const row of openJobs) {
  await releaseCredits(String(row.id), {
    from: ['reserved', 'queued', 'dispatching', 'submitted', 'unknown'],
  })
}

const mismatches = await findLedgerMismatches(sql)
const watched = new Set(
  [
    (await getBillingByUserId(sql, ind))?.id,
    (await getBillingByOrgId(sql, upgraded.orgId))?.id,
    (await getBillingByOrgId(sql, superUp.orgId))?.id,
    child.billingAccountId,
    (await getBillingByOrgId(sql, childSuper.orgId))?.id,
  ].filter(Boolean) as string[]
)
const watchedMismatches = mismatches.filter((m) => watched.has(m.billingAccountId))
assert.equal(
  watchedMismatches.length,
  0,
  `ledger mismatches: ${JSON.stringify(watchedMismatches)}`
)

console.log('orgSpend.ledgercheck: ok')
await sql.end({ timeout: 1 })
