/**
 * Expiry against local Supabase (Jan/Jun examples + idempotent cron).
 * Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/orgs/expireAdditional.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { expireAdditionalForWallet } = await import('@/lib/orgs/expireAdditional')
const {
  insertCreditTransaction,
  getBillingByUserId,
  updateBillingByUserId,
  ensureUserAndBilling,
} = await import('@/lib/db/wallet')

const jan = new Date('2026-01-15T00:00:00.000Z')
const jun = new Date('2026-06-15T00:00:00.000Z')
const expJan = new Date('2027-01-15T00:00:00.000Z')
const expJun = new Date('2027-06-15T00:00:00.000Z')
const nextJan = new Date('2027-01-16T00:00:00.000Z')

async function seedPair(
  uid: string,
  topUpBalance: number
): Promise<string> {
  await ensureUserAndBilling(sql, uid)
  const billing = await getBillingByUserId(sql, uid)
  assert.ok(billing)
  const bid = billing!.id
  await insertCreditTransaction(sql, `g_jan_${uid}`, bid, {
    user_id: uid,
    type: 'grant',
    amount: 1000,
    bucket: 'top_up',
    expires_at: expJan,
    reason: 'seed',
  })
  await sql`update credit_transactions set created_at = ${jan} where id = ${`g_jan_${uid}`}`
  await insertCreditTransaction(sql, `g_jun_${uid}`, bid, {
    user_id: uid,
    type: 'grant',
    amount: 1000,
    bucket: 'top_up',
    expires_at: expJun,
    reason: 'seed',
  })
  await sql`update credit_transactions set created_at = ${jun} where id = ${`g_jun_${uid}`}`
  await updateBillingByUserId(sql, uid, {
    topUpBalance,
    topUpReference: 2000,
  })
  return bid
}

// §5.2: bought 1000 Jan + 1000 Jun, spent 500 → next Jan expires 500
{
  const uid = `exp-${Date.now().toString(16)}`
  const bid = await seedPair(uid, 1500)
  const first = await withTx((tx) => expireAdditionalForWallet(tx, bid, nextJan))
  assert.equal(first.expired, 500)
  assert.equal(first.rows, 1)
  assert.equal((await getBillingByUserId(sql, uid))?.topUpBalance, 1000)
  const expRow = await sql`select amount from credit_transactions where id = ${`exp_g_jan_${uid}`}`
  assert.equal(Number(expRow[0]?.amount), 500)

  // Cron twice → once
  const second = await withTx((tx) => expireAdditionalForWallet(tx, bid, nextJan))
  assert.equal(second.expired, 0)
  assert.equal((await getBillingByUserId(sql, uid))?.topUpBalance, 1000)
}

// Spent 1200 → balance 800 → expire 0
{
  const uid = `exp2-${Date.now().toString(16)}`
  const bid = await seedPair(uid, 800)
  const none = await withTx((tx) => expireAdditionalForWallet(tx, bid, nextJan))
  assert.equal(none.expired, 0)
  assert.equal((await getBillingByUserId(sql, uid))?.topUpBalance, 800)
}

// Prepaid child org may be negative → expire nothing
{
  const uid = `exp3-${Date.now().toString(16)}`
  await ensureUserAndBilling(sql, uid)
  const superOrg = await sql`
    insert into organizations (public_id, kind, name, created_by)
    values (${`sorg_exp_${uid}`}, 'super_org', 'Expire Super', ${uid})
    returning id
  `
  const superId = String(superOrg[0]!.id)
  const child = await sql`
    insert into organizations (public_id, kind, parent_id, name, created_by)
    values (${`org_exp_${uid}`}, 'org', ${superId}, 'Expire Child', ${uid})
    returning id
  `
  const orgId = String(child[0]!.id)
  const wallet = await sql`
    insert into billing_accounts (owner_org_id, account_kind, access_mode, top_up_balance, top_up_reference)
    values (${orgId}, 'org', 'prepaid', -100, 0)
    returning id
  `
  const bid = String(wallet[0]!.id)
  await insertCreditTransaction(sql, `g_neg_${uid}`, bid, {
    org_id: orgId,
    type: 'grant',
    amount: 1000,
    bucket: 'top_up',
    expires_at: expJan,
    reason: 'seed',
  })
  const neg = await withTx((tx) => expireAdditionalForWallet(tx, bid, nextJan))
  assert.equal(neg.expired, 0)
}

console.log('expireAdditional.ledgercheck: ok')
await sql.end({ timeout: 1 })
