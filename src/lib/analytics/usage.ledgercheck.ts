/**
 * Usage aggregation: tz buckets, label merge, previous period, member scoping,
 * top-10, CSV escaping, and jobs filters.
 * Run: DATABASE_URL=... npx tsx src/lib/analytics/usage.ledgercheck.ts
 */
import assert from 'node:assert/strict'

import type { UsageParams } from '@/lib/analytics/usage'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const {
  ensureUserAndBilling,
  getBillingByOrgId,
  insertCreditTransaction,
  insertJob,
} = await import('@/lib/db/wallet')
const { csvCell, csvLine } = await import('@/lib/analytics/csv')
const { listOrgJobs } = await import('@/lib/analytics/jobs')
const { queryUsage, usageCsv } = await import('@/lib/analytics/usage')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')

const stamp = Date.now().toString(16)
const ownerUid = `usage-owner-${stamp}`
const memberUid = `usage-member-${stamp}`
await ensureUserAndBilling(sql, ownerUid)
await ensureUserAndBilling(sql, memberUid)
const up = await withTx((tx) => upgradeIndividualToOrg(tx, { userId: ownerUid, name: 'Usage Co' }))
assert.ok(up.ok)
if (!up.ok) throw new Error('upgrade')
const orgId = up.orgId
const billing = await getBillingByOrgId(sql, orgId)
assert.ok(billing)
await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${orgId}, ${memberUid}, 'member', 'active')
`

function params(patch: Partial<UsageParams>): UsageParams {
  return {
    from: null,
    to: null,
    tz: 'UTC',
    bucket: 'day',
    groupBy: 'model',
    member: null,
    model: null,
    jobType: null,
    csv: false,
    ...patch,
  }
}

let seq = 0
async function debit(opts: {
  at: string
  amount: number
  userId?: string
  model?: string
  requestedModel?: string
  provider?: string
  type?: 'debit' | 'refund'
}) {
  seq += 1
  await insertCreditTransaction(sql, `usage-${stamp}-${seq}`, billing!.id, {
    user_id: opts.userId ?? ownerUid,
    org_id: orgId,
    type: opts.type ?? 'debit',
    bucket: 'allocation',
    amount: opts.amount,
    provider: opts.provider ?? 'openrouter',
    model: opts.model ?? opts.requestedModel ?? 'anthropic/claude-sonnet-5',
    requested_model: opts.requestedModel ?? null,
    created_at: new Date(opts.at),
  })
}

// --- tz bucket boundaries -------------------------------------------------
// 2025-12-31T19:00:00Z is 2026-01-01T00:30:00+05:30.
await debit({ at: '2025-12-31T19:00:00Z', amount: 5 })

const utcDay = await queryUsage(
  sql,
  params({ from: '2025-12-31', to: '2025-12-31' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(utcDay.ok)
assert.equal(utcDay.result.series.length, 1)
assert.equal(utcDay.result.series[0]!.bucket, '2025-12-31')
assert.equal(utcDay.result.series[0]!.credits, 5)

const utcNextDay = await queryUsage(
  sql,
  params({ from: '2026-01-01', to: '2026-01-01' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(utcNextDay.ok)
assert.equal(utcNextDay.result.series.length, 0)

const kolkataDay = await queryUsage(
  sql,
  params({ from: '2026-01-01', to: '2026-01-01', tz: 'Asia/Kolkata' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(kolkataDay.ok)
assert.equal(kolkataDay.result.series.length, 1)
assert.equal(kolkataDay.result.series[0]!.bucket, '2026-01-01')
assert.equal(kolkataDay.result.series[0]!.credits, 5)

const badTz = await queryUsage(
  sql,
  params({ tz: 'Mars/Olympus' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.equal(badTz.ok, false)
if (!badTz.ok) assert.equal(badTz.code, 'invalid_tz')

// --- week / month buckets ---------------------------------------------------
const week = await queryUsage(
  sql,
  params({ from: '2025-12-29', to: '2026-01-04', bucket: 'week' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(week.ok)
assert.equal(week.result.series[0]!.bucket, '2025-12-29') // Monday of the week

const month = await queryUsage(
  sql,
  params({ from: '2025-12-01', to: '2025-12-31', bucket: 'month' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(month.ok)
assert.equal(month.result.series[0]!.bucket, '2025-12')

// --- group_by model + label merge -------------------------------------------
await debit({ at: '2026-02-10T10:00:00Z', amount: 3, requestedModel: 'openai/gpt-image-2', provider: 'fal' })
await debit({ at: '2026-02-10T11:00:00Z', amount: 4, requestedModel: 'openai/gpt-image-2/hd', provider: 'fal' })
const merged = await queryUsage(
  sql,
  params({ from: '2026-02-10', to: '2026-02-10', groupBy: 'model' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(merged.ok)
assert.equal(merged.result.series.length, 2)
assert.equal(merged.result.labels['openai/gpt-image-2'], 'GPT Image 2')
assert.equal(merged.result.labels['openai/gpt-image-2/hd'], 'GPT Image 2')
assert.deepEqual(merged.result.top, [{ key: 'GPT Image 2', credits: 7 }])

// --- previous period (debits minus refunds; requests = debit rows) ----------
await debit({ at: '2026-03-03T12:00:00Z', amount: 2 })
await debit({ at: '2026-03-10T12:00:00Z', amount: 4 })
await debit({ at: '2026-03-10T12:30:00Z', amount: 2 })
await debit({ at: '2026-03-10T13:00:00Z', amount: 1, type: 'refund' })
const delta = await queryUsage(
  sql,
  params({ from: '2026-03-05', to: '2026-03-11' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(delta.ok)
assert.deepEqual(delta.result.totals, { credits: 5, requests: 2 })
assert.deepEqual(delta.result.previous, { credits: 2, requests: 1 })

// --- member scoping ---------------------------------------------------------
await debit({ at: '2026-04-01T10:00:00Z', amount: 5 })
await debit({ at: '2026-04-01T11:00:00Z', amount: 4, userId: memberUid })
const ownOnly = await queryUsage(
  sql,
  params({ from: '2026-04-01', to: '2026-04-01' }),
  { kind: 'org', orgId, includeChildren: false },
  memberUid
)
assert.ok(ownOnly.ok)
assert.deepEqual(ownOnly.result.totals, { credits: 4, requests: 1 })

const byMember = await queryUsage(
  sql,
  params({ from: '2026-04-01', to: '2026-04-01', groupBy: 'member' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(byMember.ok)
assert.equal(byMember.result.totals.activeMembers, 2)
assert.equal(byMember.result.labels[ownerUid], ownerUid)
assert.equal(byMember.result.series.length, 2)

// Wallet scope (billing usage) sees the whole org wallet.
const walletScope = await queryUsage(
  sql,
  params({ from: '2026-04-01', to: '2026-04-01' }),
  { kind: 'wallet', billingAccountId: billing!.id },
  null
)
assert.ok(walletScope.ok)
assert.deepEqual(walletScope.result.totals, { credits: 9, requests: 2 })

// --- top 10 -------------------------------------------------------------------
for (let i = 1; i <= 11; i += 1) {
  await debit({ at: '2026-05-05T10:00:00Z', amount: i, requestedModel: `top/m-${i}`, model: `top/m-${i}` })
}
const topped = await queryUsage(
  sql,
  params({ from: '2026-05-05', to: '2026-05-05', groupBy: 'model' }),
  { kind: 'org', orgId, includeChildren: false },
  null
)
assert.ok(topped.ok)
assert.equal(topped.result.series.length, 11)
assert.equal(topped.result.top.length, 10)
assert.equal(topped.result.top[0]!.credits, 11)
assert.equal(
  topped.result.top.reduce((sum, row) => sum + row.credits, 0),
  65 // 66 total minus the dropped 1-credit group
)

// --- CSV cells escaped ---------------------------------------------------------
await sql`update users set display_name = ${'Csv, "Quoted"'} where id = ${memberUid}`
await debit({ at: '2026-06-01T10:00:00Z', amount: 2, userId: memberUid, requestedModel: 'csv/model', model: 'csv/model' })
const csvOut = await queryUsage(
  sql,
  params({ from: '2026-06-01', to: '2026-06-01', groupBy: 'member' }),
  { kind: 'org', orgId, includeChildren: false },
  memberUid
)
assert.ok(csvOut.ok)
const csvText = usageCsv(csvOut.result)
const expectedLine = csvLine([
  csvCell('2026-06-01'),
  csvCell(memberUid),
  csvCell('Csv, "Quoted"'),
  csvCell(2, 'number'),
  csvCell(1, 'number'),
])
assert.ok(csvText.includes(expectedLine))

// --- jobs filters ---------------------------------------------------------------
const jA = `ja-${stamp}`
const jB = `jb-${stamp}`
const jC = `jc-${stamp}`
await insertJob(sql, jA, ownerUid, billing!.id, {
  orgId,
  provider: 'openrouter',
  status: 'settled',
  requestedModel: 'anthropic/claude-sonnet-5',
  settledCredits: 3,
  createdAt: new Date('2026-07-01T10:00:00Z'),
})
await insertJob(sql, jB, ownerUid, billing!.id, {
  orgId,
  provider: 'fal',
  status: 'dispatching',
  requestedModel: 'openai/gpt-image-2',
  estimatedCredits: 8,
  createdAt: new Date('2026-07-02T10:00:00Z'),
})
await insertJob(sql, jC, memberUid, billing!.id, {
  orgId,
  provider: 'tavily',
  status: 'settled',
  requestedModel: 'tavily-search',
  settledCredits: 1,
  createdAt: new Date('2026-07-03T10:00:00Z'),
})

const ids = (items: { id: string }[]) => items.map((item) => item.id).sort()

const settled = await listOrgJobs(sql, { orgId, status: 'settled', limit: 50 })
assert.deepEqual(ids(settled.items), [jA, jC].sort())

const images = await listOrgJobs(sql, { orgId, jobType: 'Image', limit: 50 })
assert.deepEqual(ids(images.items), [jB])

const searches = await listOrgJobs(sql, { orgId, jobType: 'Search', limit: 50 })
assert.deepEqual(ids(searches.items), [jC])

const chats = await listOrgJobs(sql, { orgId, jobType: 'Chat', limit: 50 })
assert.deepEqual(ids(chats.items), [jA])

const memberJobs = await listOrgJobs(sql, { orgId, userId: memberUid, limit: 50 })
assert.deepEqual(ids(memberJobs.items), [jC])

const memberSettled = await listOrgJobs(sql, { orgId, userId: memberUid, status: 'settled', limit: 50 })
assert.deepEqual(ids(memberSettled.items), [jC])

const modelJobs = await listOrgJobs(sql, { orgId, model: 'tavily-search', limit: 50 })
assert.deepEqual(ids(modelJobs.items), [jC])

const ranged = await listOrgJobs(sql, {
  orgId,
  from: new Date('2026-07-02T00:00:00Z'),
  to: new Date('2026-07-03T00:00:00Z'),
  limit: 50,
})
assert.deepEqual(ids(ranged.items), [jB])

const walletJobs = await listOrgJobs(sql, { billingAccountId: billing!.id, limit: 50 })
assert.deepEqual(ids(walletJobs.items), [jA, jB, jC].sort())

console.log('usage.ledgercheck: ok')
await sql.end({ timeout: 1 })
