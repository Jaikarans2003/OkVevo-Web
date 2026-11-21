/**
 * PR 2b-a Layer 1: accept/leave/lots/sponsored against local Supabase.
 * Run: DATABASE_URL=... npx tsx src/lib/orgs/wallet2bA.ledgercheck.ts
 */
import assert from 'node:assert/strict'
import postgres from 'postgres'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.ADMIN_EMAILS ??= 'admin@okvevo.com'
// Lets firebase-admin init without a real service account (auth is mocked below).
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:9099'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { acceptParent } = await import('@/lib/orgs/acceptParent')
const { leaveOrRemoveParent, previewLeaveDebt } = await import('@/lib/orgs/leaveOrRemoveParent')
const { grantCredits } = await import('@/lib/gateway/debit')
const {
  getBillingByOrgId,
  insertCreditTransaction,
  insertJob,
  lockBillingById,
  updateBillingById,
} = await import('@/lib/db/wallet')
const {
  loadAllocationLots,
  remainingByLot,
  remainingForSubscription,
} = await import('@/lib/billing/allocationLots')
const { expireAllocationLotsForWallet } = await import('@/lib/billing/expireAllocationLots')
const {
  installRazorpayApiMock,
  installFirebaseAuthMock,
  setFakeAuthUid,
  setRazorpayResponder,
  resetRazorpayResponder,
} = await import('@/lib/billing/layer1Harness')
const { cancelSubscriptionAtPeriodEndAfterCommit } = await import(
  '@/lib/billing/cancelSubscriptionAtPeriodEnd'
)
const { additionalRemainingPct } = await import('@/types/credits')

const stamp = Date.now().toString(16)
const uid = `w2ba-${stamp}`

await sql`insert into users (id) values (${uid}) on conflict (id) do nothing`

const superRows = await sql`
  insert into organizations (public_id, kind, name, created_by)
  values (${`sorg_w2ba_${stamp}`}, 'super_org', 'W2ba Super', ${uid})
  returning id, public_id
`
const superId = String(superRows[0]!.id)

const childRows = await sql`
  insert into organizations (public_id, kind, name, created_by)
  values (${`org_w2ba_${stamp}`}, 'org', 'W2ba Child', ${uid})
  returning id, public_id
`
const childId = String(childRows[0]!.id)

await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${childId}, ${uid}, 'owner', 'active'),
         (${superId}, ${uid}, 'owner', 'active')
`

const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
const childWallet = await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, plan_status, plan, credits_included,
    allocation_balance, top_up_balance, top_up_reference,
    razorpay_subscription_id, current_period_end
  ) values (
    ${childId}, 'org', 'subscription', 'active', 'starter', 20000,
    15000, 500, 500,
    ${`sub_w2ba_${stamp}`}, ${periodEnd}
  ) returning id
`
const childWalletId = String(childWallet[0]!.id)

await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, plan_status, current_period_end,
    top_up_balance, top_up_reference, allocation_balance, credits_included
  ) values (
    ${superId}, 'super_org', 'subscription', 'active', ${periodEnd},
    1000, 1000, 20000, 20000
  )
`

// --- acceptParent: prepaid, balances kept ---
const accepted = await withTx((tx) =>
  acceptParent(tx, { childOrgId: childId, superOrgId: superId })
)
assert.equal(accepted.ok, true)
if (!accepted.ok) throw new Error('unreachable')
assert.equal(accepted.allocationBalance, 15000)
assert.equal(accepted.topUpBalance, 500)
const childAfterAccept = await getBillingByOrgId(sql, childId)
assert.equal(childAfterAccept?.accessMode, 'prepaid')
const orgAfter = await sql`select parent_id from organizations where id = ${childId}`
assert.equal(String(orgAfter[0]!.parent_id), superId)

// Decline path is absence of accept — parent stays null when we never call accept (covered by already_parented).
const second = await withTx((tx) =>
  acceptParent(tx, { childOrgId: childId, superOrgId: superId })
)
assert.equal(second.ok, false)
if (second.ok) throw new Error('unreachable')
assert.equal(second.code, 'already_parented')

// --- cancel after commit with forced Razorpay failure → HIGH alert, still prepaid ---
await installRazorpayApiMock()
setRazorpayResponder(() => {
  throw Object.assign(new Error('forced cancel fail'), { statusCode: 500 })
})
const cancelRes = await cancelSubscriptionAtPeriodEndAfterCommit({
  billingAccountId: childWalletId,
  razorpaySubscriptionId: `sub_w2ba_${stamp}`,
  reason: 'accept.parent.l1',
  maxAttempts: 2,
})
assert.equal(cancelRes.alerted, true)
const stillPrepaid = await getBillingByOrgId(sql, childId)
assert.equal(stillPrepaid?.accessMode, 'prepaid')
assert.equal(stillPrepaid?.cancelAtPeriodEnd, true)
const alerts = await sql`
  select id from ops_alerts where id like ${`rzp-cancel-fail-${childWalletId}%`}
`
assert.ok(alerts.length >= 1)
resetRazorpayResponder()

// --- open hold → leave 409 ---
await insertJob(sql, `job_w2ba_${stamp}`, uid, childWalletId, {
  provider: 'openrouter',
  estimatedCredits: 10,
  status: 'reserved',
  heldAllocation: 10,
  heldTopUp: 0,
})
const blocked = await withTx((tx) =>
  leaveOrRemoveParent(tx, {
    childOrgId: childId,
    superOrgId: superId,
    actorUserId: uid,
    action: 'leave',
  })
)
assert.equal(blocked.ok, false)
if (blocked.ok) throw new Error('unreachable')
assert.equal(blocked.code, 'jobs_in_flight')
const stillParent = await sql`select parent_id from organizations where id = ${childId}`
assert.equal(String(stillParent[0]!.parent_id), superId)

await sql`update gateway_jobs set status = 'settled' where id = ${`job_w2ba_${stamp}`}`

// --- leave with sponsored debt absorbed ---
await updateBillingById(sql, childWalletId, {
  sponsoredBalance: -80,
  sponsoredReference: 0,
})
const superBa = await getBillingByOrgId(sql, superId)
assert.ok(superBa)
// Super top_up 1000 covers 80 — no absorb
assert.equal(previewLeaveDebt(-80), 80)
const left = await withTx((tx) =>
  leaveOrRemoveParent(tx, {
    childOrgId: childId,
    superOrgId: superId,
    actorUserId: uid,
    action: 'leave',
  })
)
assert.equal(left.ok, true)
if (!left.ok) throw new Error('unreachable')
assert.equal(left.debtFromSuperTopUp, 80)
assert.equal(left.debtAbsorbed, 0)
const afterLeave = await getBillingByOrgId(sql, childId)
assert.equal(afterLeave?.accessMode, 'subscription')
assert.equal(afterLeave?.sponsoredBalance, 0)
const parentNull = await sql`select parent_id from organizations where id = ${childId}`
assert.equal(parentNull[0]!.parent_id, null)
const audit = await sql`
  select action from audit_log where target_id = ${childId} and action = 'org.leave_super'
`
assert.equal(audit.length, 1)
// Fix 4: debt paydown must not reset topUpReference → additionalPct below 100.
const superAfterDebt = await getBillingByOrgId(sql, superId)
assert.ok(superAfterDebt)
assert.equal(superAfterDebt!.topUpBalance, 920)
assert.equal(superAfterDebt!.topUpReference, 1000)
assert.ok(
  additionalRemainingPct(superAfterDebt!.topUpBalance, superAfterDebt!.topUpReference) < 100
)

// --- Fix 1: org owner who is not platform admin → accept-parent 403 ---
await installFirebaseAuthMock()
setFakeAuthUid(uid)
{
  const { NextRequest } = await import('next/server')
  const { POST } = await import('@/app/api/orgs/[publicId]/accept-parent/route')
  const childPub = String(childRows[0]!.public_id)
  const superPub = String(superRows[0]!.public_id)
  // Mock email is `${uid}@layer1.test` (not in ADMIN_EMAILS) → forbidden before accept.
  const req = new NextRequest(`http://localhost/api/orgs/${childPub}/accept-parent`, {
    method: 'POST',
    headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json' },
    body: JSON.stringify({ superOrgPublicId: superPub }),
  })
  const res = await POST(req, { params: Promise.resolve({ publicId: childPub }) })
  assert.equal(res.status, 403)
  const body = (await res.json()) as { code?: string }
  assert.equal(body.code, 'forbidden')
}

// --- Fix 2: reserve holds child wallet lock; Leave waits then 409 ---
{
  const raceUid = `w2ba-lock-${stamp}`
  await sql`insert into users (id) values (${raceUid}) on conflict (id) do nothing`
  const sRows = await sql`
    insert into organizations (public_id, kind, name, created_by)
    values (${`sorg_lock_${stamp}`}, 'super_org', 'Lock Super', ${raceUid})
    returning id
  `
  const cRows = await sql`
    insert into organizations (public_id, kind, name, created_by, parent_id)
    values (${`org_lock_${stamp}`}, 'org', 'Lock Child', ${raceUid}, ${sRows[0]!.id})
    returning id
  `
  const sId = String(sRows[0]!.id)
  const cId = String(cRows[0]!.id)
  await sql`
    insert into memberships (org_id, user_id, role, status)
    values (${cId}, ${raceUid}, 'owner', 'active'), (${sId}, ${raceUid}, 'owner', 'active')
  `
  const cw = await sql`
    insert into billing_accounts (
      owner_org_id, account_kind, access_mode, plan_status, allocation_balance, top_up_balance
    ) values (${cId}, 'org', 'prepaid', 'active', 5000, 0)
    returning id
  `
  await sql`
    insert into billing_accounts (
      owner_org_id, account_kind, access_mode, plan_status, top_up_balance, top_up_reference
    ) values (${sId}, 'super_org', 'subscription', 'active', 500, 500)
  `
  const cwId = String(cw[0]!.id)
  const jobId = `job_lock_${stamp}`
  const dbUrl = process.env.DATABASE_URL!
  const a = postgres(dbUrl, { max: 1 })
  try {
    let unlock!: () => void
    const locked = new Promise<void>((resolve) => {
      unlock = resolve
    })
    const holdP = a.begin(async (txA) => {
      await lockBillingById(txA as never, cwId)
      await insertJob(txA as never, jobId, raceUid, cwId, {
        provider: 'openrouter',
        estimatedCredits: 10,
        status: 'reserved',
        heldAllocation: 10,
        heldTopUp: 0,
      })
      unlock()
      await new Promise((r) => setTimeout(r, 400))
    })
    await locked
    const raced = await withTx((tx) =>
      leaveOrRemoveParent(tx, {
        childOrgId: cId,
        superOrgId: sId,
        actorUserId: raceUid,
        action: 'leave',
      })
    )
    assert.equal(raced.ok, false)
    if (raced.ok) throw new Error('unreachable')
    assert.equal(raced.code, 'jobs_in_flight')
    await holdP
  } finally {
    await a.end({ timeout: 1 })
  }
}

// --- Fix 3: two sponsored lots → two return rows with matching expires_at ---
{
  const lotUid = `w2ba-ret-${stamp}`
  await sql`insert into users (id) values (${lotUid}) on conflict (id) do nothing`
  const sRows = await sql`
    insert into organizations (public_id, kind, name, created_by)
    values (${`sorg_ret_${stamp}`}, 'super_org', 'Ret Super', ${lotUid})
    returning id
  `
  const cRows = await sql`
    insert into organizations (public_id, kind, name, created_by, parent_id)
    values (${`org_ret_${stamp}`}, 'org', 'Ret Child', ${lotUid}, ${sRows[0]!.id})
    returning id
  `
  const sId = String(sRows[0]!.id)
  const cId = String(cRows[0]!.id)
  await sql`
    insert into memberships (org_id, user_id, role, status)
    values (${cId}, ${lotUid}, 'owner', 'active'), (${sId}, ${lotUid}, 'owner', 'active')
  `
  const cw = await sql`
    insert into billing_accounts (
      owner_org_id, account_kind, access_mode, plan_status,
      sponsored_balance, sponsored_reference, allocation_balance
    ) values (${cId}, 'org', 'prepaid', 'active', 300, 300, 0)
    returning id
  `
  const sw = await sql`
    insert into billing_accounts (
      owner_org_id, account_kind, access_mode, plan_status, top_up_balance, top_up_reference
    ) values (${sId}, 'super_org', 'subscription', 'active', 0, 0)
    returning id
  `
  const cwId = String(cw[0]!.id)
  const swId = String(sw[0]!.id)
  const expA = new Date('2027-01-15T00:00:00.000Z')
  const expB = new Date('2027-06-15T00:00:00.000Z')
  await insertCreditTransaction(sql, `ret_in_a_${stamp}`, cwId, {
    user_id: lotUid,
    org_id: cId,
    super_org_id: sId,
    type: 'transfer_in',
    amount: 100,
    bucket: 'sponsored',
    reason: 'test.seed',
    expires_at: expA,
    counterparty_billing_account_id: swId,
  })
  await insertCreditTransaction(sql, `ret_in_b_${stamp}`, cwId, {
    user_id: lotUid,
    org_id: cId,
    super_org_id: sId,
    type: 'transfer_in',
    amount: 200,
    bucket: 'sponsored',
    reason: 'test.seed',
    expires_at: expB,
    counterparty_billing_account_id: swId,
  })
  const returned = await withTx((tx) =>
    leaveOrRemoveParent(tx, {
      childOrgId: cId,
      superOrgId: sId,
      actorUserId: lotUid,
      action: 'leave',
    })
  )
  assert.equal(returned.ok, true)
  if (!returned.ok) throw new Error('unreachable')
  assert.equal(returned.sponsoredReturned, 300)
  const inRows = await sql`
    select amount, expires_at from credit_transactions
    where billing_account_id = ${swId}
      and type = 'transfer_in'
      and reason = 'org.leave.return'
    order by expires_at asc
  `
  assert.equal(inRows.length, 2)
  assert.equal(Number(inRows[0]!.amount), 100)
  assert.equal(Number(inRows[1]!.amount), 200)
  assert.equal(new Date(String(inRows[0]!.expires_at)).toISOString(), expA.toISOString())
  assert.equal(new Date(String(inRows[1]!.expires_at)).toISOString(), expB.toISOString())
}

// --- allocation lots: old annual untouched after monthly SET; draw old first ---
const lotUid = `lot-${stamp}`
await sql`insert into users (id) values (${lotUid}) on conflict (id) do nothing`
await sql`insert into billing_accounts (owner_user_id) values (${lotUid}) on conflict do nothing`
const lotBa = await sql`select id from billing_accounts where owner_user_id = ${lotUid}`
const lotId = String(lotBa[0]!.id)
const annualEnd = new Date('2027-01-01T00:00:00.000Z')
const monthlyEnd = new Date('2026-07-01T00:00:00.000Z')

await grantCredits({
  billingAccountId: lotId,
  amount: 1000,
  reason: 'test.annual',
  bucket: 'allocation',
  mode: 'set',
  requestId: `lot_annual_${stamp}`,
  razorpaySubscriptionId: 'sub_annual',
  expiresAt: annualEnd,
  userPatch: { creditsIncluded: 1000, razorpaySubscriptionId: 'sub_annual' },
})
await grantCredits({
  billingAccountId: lotId,
  amount: 2000,
  reason: 'test.monthly',
  bucket: 'allocation',
  mode: 'add',
  requestId: `lot_monthly_${stamp}`,
  razorpaySubscriptionId: 'sub_monthly',
  expiresAt: monthlyEnd,
  userPatch: { creditsIncluded: 2000, razorpaySubscriptionId: 'sub_monthly' },
})
let ba = await sql`select allocation_balance from billing_accounts where id = ${lotId}`
assert.equal(Number(ba[0]!.allocation_balance), 3000)

// Renewal SET on monthly only
await grantCredits({
  billingAccountId: lotId,
  amount: 2000,
  reason: 'subscription.charged',
  bucket: 'allocation',
  mode: 'set',
  requestId: `lot_monthly_renew_${stamp}`,
  razorpaySubscriptionId: 'sub_monthly',
  expiresAt: monthlyEnd,
})
ba = await sql`select allocation_balance from billing_accounts where id = ${lotId}`
assert.equal(Number(ba[0]!.allocation_balance), 3000) // annual 1000 + monthly 2000
assert.equal(
  remainingForSubscription(await loadAllocationLots(sql, lotId), 3000, 'sub_annual'),
  1000
)

const lots = await loadAllocationLots(sql, lotId)
const rem = remainingByLot(lots, 3000)
assert.equal(rem[0]!.subscriptionId, 'sub_monthly') // monthly expires sooner (2026-07)
// Force-expire annual lot
await sql`
  update credit_transactions
  set expires_at = ${new Date('2020-01-01')}
  where billing_account_id = ${lotId}
    and razorpay_subscription_id = 'sub_annual'
    and type = 'grant'
`
// Fixed "now": after the forced annual expiry, before monthly's real expiry.
const expireCheckNow = new Date('2026-06-01T00:00:00.000Z')
const expired = await withTx((tx) => expireAllocationLotsForWallet(tx, lotId, expireCheckNow))
assert.ok(expired.expired >= 1000)
ba = await sql`select allocation_balance from billing_accounts where id = ${lotId}`
assert.equal(Number(ba[0]!.allocation_balance), 2000)

console.log('wallet2bA.ledgercheck: ok')
await sql.end({ timeout: 1 })
