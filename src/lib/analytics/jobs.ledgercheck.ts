/**
 * Jobs list returns the customer label and no provider column.
 * Run: DATABASE_URL=... npx tsx src/lib/analytics/jobs.ledgercheck.ts
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
  insertJob,
} = await import('@/lib/db/wallet')
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

// Org-billed Fal image: commitFalSubmitted stamps the hold wallet on the alias;
// Jobs lists the hold once and never the alias.
const { commitFalSubmitted, falRunDocId, insertIdemRow } = await import('@/lib/gateway/debit')
const holdId = `falhold-${stamp}`
const falId = `falreq-${stamp}`
const runId = `falrun-${stamp}`
await insertJob(sql, holdId, uid, billing!.id, {
  orgId: up.orgId,
  provider: 'fal',
  status: 'dispatching',
  endpoint: 'fal-ai/flux-2/klein/9b',
  estimatedCredits: 8,
  heldAllocation: 8,
  runId,
})
await withTx((tx) =>
  insertIdemRow(tx, falRunDocId(uid, runId), {
    uid,
    runId,
    bodyHash: 'body',
    phase: 'queued',
    submitStarted: false,
    holdId,
  })
)
const submitted = await commitFalSubmitted({
  holdId,
  uid,
  runId,
  falRequestId: falId,
  falStatusUrl: 'https://example.test/status',
  falResponseUrl: 'https://example.test/response',
  falCancelUrl: 'https://example.test/cancel',
})
assert.equal(submitted.ok, true)
const alias = await getJob(sql, falId)
assert.equal(alias?.billingAccountId, billing!.id)
assert.equal(alias?.orgId, up.orgId)
assert.equal(alias?.aliasOf, holdId)
const afterAlias = await listOrgJobs(sql, { orgId: up.orgId, limit: 20 })
assert.equal(afterAlias.items.filter((item) => item.id === holdId).length, 1)
assert.equal(afterAlias.items.filter((item) => item.id === falId).length, 0)
const counted = await sql`
  select count(*)::int as n from gateway_jobs
  where org_id = ${up.orgId} and id in (${holdId}, ${falId}) and alias_of is null
`
assert.equal(Number(counted[0]?.n), 1)

// Usage is credit_transactions / usage_daily — one debit on the hold, never on the alias.
await insertCreditTransaction(sql, `fal-txn-${stamp}`, billing!.id, {
  user_id: uid,
  org_id: up.orgId,
  type: 'debit',
  bucket: 'allocation',
  amount: 8,
  provider: 'fal',
  model: 'fal-ai/flux-2/klein/9b',
  requested_model: 'fal-ai/flux-2/klein/9b',
  request_id: holdId,
})
const usage = await sql`
  select coalesce(sum(requests), 0)::int as requests, coalesce(sum(credits), 0)::int as credits
  from usage_daily
  where org_id = ${up.orgId} and user_id = ${uid} and model = ${'fal-ai/flux-2/klein/9b'}
`
assert.equal(Number(usage[0]?.requests), 1)
assert.equal(Number(usage[0]?.credits), 8)
const aliasDebits = await sql`
  select count(*)::int as n from credit_transactions
  where request_id = ${falId} and type = 'debit'
`
assert.equal(Number(aliasDebits[0]?.n), 0)

// Backfill: wrong-wallet alias → parent copy; second run changes nothing.
const personalUid = `alias-personal-${stamp}`
await ensureUserAndBilling(sql, personalUid)
const personalBilling = await getBillingByUserId(sql, personalUid)
assert.ok(personalBilling)
const staleAliasId = `stale-alias-${stamp}`
const parentHoldId = `stale-hold-${stamp}`
await insertJob(sql, parentHoldId, uid, billing!.id, {
  orgId: up.orgId,
  provider: 'fal',
  status: 'submitted',
})
await insertJob(sql, staleAliasId, uid, personalBilling!.id, {
  aliasOf: parentHoldId,
})
const runBackfill = () => sql`
  with updated as (
    update gateway_jobs as alias
    set
      billing_account_id = parent.billing_account_id,
      org_id = parent.org_id,
      super_org_id = parent.super_org_id
    from gateway_jobs as parent
    where alias.alias_of is not null
      and alias.alias_of = parent.id
      and (
        alias.billing_account_id is distinct from parent.billing_account_id
        or alias.org_id is distinct from parent.org_id
        or alias.super_org_id is distinct from parent.super_org_id
      )
    returning alias.id
  )
  select count(*)::int as n from updated
`
const first = await runBackfill()
assert.ok(Number(first[0]?.n) >= 1)
const fixed = await getJob(sql, staleAliasId)
assert.equal(fixed?.billingAccountId, billing!.id)
assert.equal(fixed?.orgId, up.orgId)
const second = await runBackfill()
assert.equal(Number(second[0]?.n), 0)

console.log('jobs.ledgercheck: ok')
await sql.end({ timeout: 1 })
