/**
 * Transfer + debt recovery against local Supabase.
 * Run: DATABASE_URL=... npx tsx src/lib/orgs/transferCredits.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { transferCredits } = await import('@/lib/orgs/transferCredits')
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

const childWallet = await sql`
  insert into billing_accounts (
    owner_org_id, account_kind, access_mode, top_up_balance, top_up_reference
  ) values (
    ${childId}, 'org', 'prepaid', -300, 0
  ) returning id
`
const childWalletId = String(childWallet[0]!.id)

const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
await insertCreditTransaction(sql, `grant_xfer_${uid}`, superWalletId, {
  user_id: uid,
  type: 'grant',
  amount: 10000,
  bucket: 'top_up',
  reason: 'seed',
  expires_at: exp,
})

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
  select amount from credit_transactions
  where id = ${`xfer_k1_${uid}:debt`}
`
assert.equal(Number(debtRows[0]?.amount), 300)

const inRows = await sql`
  select amount, expires_at from credit_transactions
  where id = ${`xfer_k1_${uid}:in:1`}
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
