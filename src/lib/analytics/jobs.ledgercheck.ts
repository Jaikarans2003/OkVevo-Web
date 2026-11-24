/**
 * Jobs list returns the customer label and no provider column.
 * Run: DATABASE_URL=... npx tsx src/lib/analytics/jobs.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { ensureUserAndBilling, getBillingByOrgId, insertCreditTransaction, insertJob } = await import('@/lib/db/wallet')
const { listOrgJobs } = await import('@/lib/analytics/jobs')
const { listOrgCredits } = await import('@/lib/analytics/credits')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')

const stamp = Date.now().toString(16)
const uid = `job-${stamp}`
await ensureUserAndBilling(sql, uid)
const up = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: uid, name: 'Jobs Co' }))
assert.ok(up.ok)
if (!up.ok) throw new Error('upgrade')
const billing = await getBillingByOrgId(sql, up.orgId)
assert.ok(billing)
const id = `jobrow-${stamp}`
await insertJob(sql, id, uid, billing!.id, {
  orgId: up.orgId,
  provider: 'openrouter',
  status: 'settled',
  requestedModel: 'okvevo/auto-cost',
  model: 'anthropic/claude-sonnet-5',
  estimatedCredits: 3,
  settledCredits: 3,
})

const page = await listOrgJobs(sql, { orgId: up.orgId, limit: 10 })
const row = page.items.find((item) => item.id === id)
assert.ok(row)
assert.equal(row!.modelLabel, 'Auto · Cost-effective')
assert.equal(row!.jobType, 'Chat')
assert.equal(row!.credits, 3)
assert.equal(Object.hasOwn(row!, 'provider'), false)
assert.equal(Object.hasOwn(row!, 'model'), false)

await insertCreditTransaction(sql, `txn-${stamp}`, billing!.id, {
  user_id: uid,
  org_id: up.orgId,
  type: 'debit',
  bucket: 'allocation',
  amount: 3,
  provider: 'openrouter',
  model: 'anthropic/claude-sonnet-5',
  requested_model: 'okvevo/auto-cost',
  request_id: id,
})
const credits = await listOrgCredits(sql, { orgId: up.orgId, limit: 10 })
const line = credits.items.find((item) => item.requestId === id)
assert.ok(line)
assert.equal(line!.modelLabel, 'Auto · Cost-effective')
assert.equal(Object.hasOwn(line!, 'provider'), false)
assert.equal(Object.hasOwn(line!, 'cost_usd'), false)

console.log('jobs.ledgercheck: ok')
await sql.end({ timeout: 1 })
