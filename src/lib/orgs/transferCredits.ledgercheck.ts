/**
 * Transfer + debt recovery + scoped idempotency against local Supabase.
 * Run: DATABASE_URL=... npx tsx src/lib/orgs/transferCredits.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { transferCredits, transferLedgerIds } = await import('@/lib/orgs/transferCredits')
const { insertCreditTransaction, updateBillingById, getBillingByOrgId } =
  await import('@/lib/db/wallet')

const uid = `xfer-owner-${Date.now().toString(16)}`
const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

await sql`insert into users (id) values (${uid}) on conflict (id) do nothing`

const superRows = await sql`
  insert into organizations (public_id, kind, name, created_by)
  values (${`sorg_xfer_${uid.slice(-12)}`}, 'super_org', 'Xfer Super', ${uid})
  returning id
`
const superId = String(superRows[0]!.id)

const childRows = await sql`
  insert into organizations (public_id, kind, parent_id, name, created_by)
  values (${`org_xfer_${uid.slice(-12)}`}, 'org', ${superId}, 'Xfer Child', ${uid})
  returning id
`
const childId = String(childRows[0]!.id)

const child2Rows = await sql`
  insert into organizations (public_id, kind, parent_id, name, created_by)
  values (${`org_xfer2_${uid.slice(-12)}`}, 'org', ${superId}, 'Xfer Child 2', ${uid})
  returning id
`
const child2Id = String(child2Rows[0]!.id)

await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${superId}, ${uid}, 'owner', 'active')
`

const superWallet = await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, plan_status, current_period_end,
    top_up_balance, top_up_reference, credits_included, allocation_balance
  ) values (
    ${superId}, 'super_org', 'subscription', 'active', ${periodEnd},
    10000, 10000, 20000, 20000
  ) returning id
`
const superWalletId = String(superWallet[0]!.id)

await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, top_up_balance, top_up_reference
  ) values (
    ${childId}, 'org', 'prepaid', -300, 0
  ) returning id
`

await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, top_up_balance, top_up_reference
  ) values (
    ${child2Id}, 'org', 'prepaid', 0, 0
  ) returning id
`

const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
await insertCreditTransaction(sql, `grant_xfer_${uid}`, superWalletId, {
  user_id: uid,
  type: 'grant',
  amount: 10000,
  bucket: 'top_up',
  reason: 'seed',
  expires_at: exp,
})

const ids = transferLedgerIds(superWalletId, `k1_${uid}`)

// Debt recovery: child at -300, transfer 1000 → debt 300, balance 700, top_up_reference 700
const first = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superId,
    toOrgId: childId,
    credits: 1000,
    idempotencyKey: `k1_${uid}`,
    actorUserId: uid,
  })
)
assert.equal(first.ok, true)
if (!first.ok) throw new Error('unreachable')
assert.equal(first.debtRecovered, 300)
assert.equal(first.toBalance, 700)
assert.equal(first.fromBalance, 9000)

const childAfter = await getBillingByOrgId(sql, childId)
assert.equal(childAfter?.topUpBalance, 700)
assert.equal(childAfter?.topUpReference, 700)

const debtRows = await sql`
  select amount from credit_transactions where id = ${ids.debt}
`
assert.equal(Number(debtRows[0]?.amount), 300)

const inRows = await sql`
  select amount, expires_at from credit_transactions where id = ${ids.in(1)}
`
assert.equal(Number(inRows[0]?.amount), 700)
assert.ok(inRows[0]?.expires_at)

// Replay same key → idempotent, no second move
const replay = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superId,
    toOrgId: childId,
    credits: 1000,
    idempotencyKey: `k1_${uid}`,
    actorUserId: uid,
  })
)
assert.equal(replay.ok, true)
if (!replay.ok) throw new Error('unreachable')
assert.equal(replay.idempotent, true)
const childReplay = await getBillingByOrgId(sql, childId)
assert.equal(childReplay?.topUpBalance, 700)

// Same key, different amount → 409 idempotency_conflict
const badAmount = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superId,
    toOrgId: childId,
    credits: 500,
    idempotencyKey: `k1_${uid}`,
    actorUserId: uid,
  })
)
assert.equal(badAmount.ok, false)
if (badAmount.ok) throw new Error('unreachable')
assert.equal(badAmount.code, 'idempotency_conflict')

// Same key, different target → 409
const badTarget = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superId,
    toOrgId: child2Id,
    credits: 1000,
    idempotencyKey: `k1_${uid}`,
    actorUserId: uid,
  })
)
assert.equal(badTarget.ok, false)
if (badTarget.ok) throw new Error('unreachable')
assert.equal(badTarget.code, 'idempotency_conflict')

// Second super-org can reuse the same client key (ids scoped to source wallet)
const uid2 = `xfer2-${uid.slice(-8)}`
await sql`insert into users (id) values (${uid2}) on conflict (id) do nothing`
const super2Rows = await sql`
  insert into organizations (public_id, kind, name, created_by)
  values (${`sorg_xferB_${uid.slice(-8)}`}, 'super_org', 'Other Super', ${uid2})
  returning id
`
const super2Id = String(super2Rows[0]!.id)
const childBRows = await sql`
  insert into organizations (public_id, kind, parent_id, name, created_by)
  values (${`org_xferB_${uid.slice(-8)}`}, 'org', ${super2Id}, 'Other Child', ${uid2})
  returning id
`
const childBId = String(childBRows[0]!.id)
const super2Wallet = await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, plan_status, current_period_end,
    top_up_balance, top_up_reference
  ) values (
    ${super2Id}, 'super_org', 'subscription', 'active', ${periodEnd},
    5000, 5000
  ) returning id
`
const super2WalletId = String(super2Wallet[0]!.id)
await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, top_up_balance
  ) values (${childBId}, 'org', 'prepaid', 0)
`
await insertCreditTransaction(sql, `grant_xferB_${uid}`, super2WalletId, {
  type: 'grant',
  amount: 5000,
  bucket: 'top_up',
  expires_at: exp,
})
const otherKey = `k1_${uid}` // same client key as first super-org
const other = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: super2Id,
    toOrgId: childBId,
    credits: 100,
    idempotencyKey: otherKey,
    actorUserId: uid2,
  })
)
assert.equal(other.ok, true)
if (!other.ok) throw new Error(other.code)
assert.equal(other.idempotent, false)
const otherIds = transferLedgerIds(super2WalletId, otherKey)
assert.notEqual(otherIds.out, ids.out)
const otherOut = await sql`select amount from credit_transactions where id = ${otherIds.out}`
assert.equal(Number(otherOut[0]?.amount), 100)

// Concurrent identical requests → one transfer, both ok + same balances
const beforeConcurrent = await getBillingByOrgId(sql, childId)
const concurrentKey = `kconc_${uid}`
const concurrent = await Promise.all(
  [1, 2].map(() =>
    withTx((tx) =>
      transferCredits(tx, {
        fromSuperOrgId: superId,
        toOrgId: childId,
        credits: 50,
        idempotencyKey: concurrentKey,
        actorUserId: uid,
      })
    )
  )
)
assert.ok(concurrent.every((r) => r.ok))
const moved = concurrent.filter((r) => r.ok && !r.idempotent)
const replayed = concurrent.filter((r) => r.ok && r.idempotent)
assert.equal(moved.length, 1)
assert.equal(replayed.length, 1)
const afterConcurrent = await getBillingByOrgId(sql, childId)
assert.equal(
  afterConcurrent!.topUpBalance,
  (beforeConcurrent?.topUpBalance ?? 0) + 50
)

// Above balance → 402
const tooMuch = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superId,
    toOrgId: childId,
    credits: 999999,
    idempotencyKey: `k2_${uid}`,
    actorUserId: uid,
  })
)
assert.equal(tooMuch.ok, false)
if (tooMuch.ok) throw new Error('unreachable')
assert.equal(tooMuch.code, 'insufficient_quota')

// Lapsed super-org plan → plan_not_active
await updateBillingById(sql, superWalletId, {
  currentPeriodEnd: new Date(Date.now() - 60_000),
})
const lapsed = await withTx((tx) =>
  transferCredits(tx, {
    fromSuperOrgId: superId,
    toOrgId: childId,
    credits: 10,
    idempotencyKey: `k3_${uid}`,
    actorUserId: uid,
  })
)
assert.equal(lapsed.ok, false)
if (lapsed.ok) throw new Error('unreachable')
assert.equal(lapsed.code, 'plan_not_active')

console.log('transferCredits.ledgercheck: ok')
await sql.end({ timeout: 1 })
