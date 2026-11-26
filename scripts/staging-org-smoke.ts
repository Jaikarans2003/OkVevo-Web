/**
 * Staging org smoke (plan §11.5): super-org → child → transfer → join code → second user joins.
 *
 *   npx tsx scripts/staging-org-smoke.ts
 *   npx tsx scripts/staging-org-smoke.ts --origin https://okvevo-web--okvevo-testing.us-central1.hosted.app
 *
 * Fail-closed: refuses production origins. Seeds the super-org wallet via DATABASE_URL
 * (staging pooler). Without DATABASE_URL, stops after approve and prints SEED_SQL for ops.
 *
 * Loads .env / .env.local (FB_SERVICE_ACCOUNT_KEY, NEXT_PUBLIC_FIREBASE_API_KEY, ADMIN_EMAILS).
 * Never prints secrets or tokens.
 */
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const STATE_PATH = resolve(process.cwd(), '.staging-org-smoke-state.json')

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts'
const DEFAULT_ORIGIN = 'https://okvevo-web--okvevo-testing.us-central1.hosted.app'
const TRANSFER_CREDITS = 10_000
const SEED_TOP_UP = 50_000
const SEED_ALLOCATION = 1_000

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!(k in process.env)) process.env[k] = v
  }
}

loadEnvFile(resolve(process.cwd(), '.env'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

function flag(name: string, fallback = ''): string {
  const i = process.argv.indexOf(name)
  if (i < 0) return fallback
  return String(process.argv[i + 1] || '').trim() || fallback
}

function required(name: string): string {
  const v = (process.env[name] ?? '').trim()
  if (!v) throw new Error(`missing env ${name}`)
  return v
}

export function assertStagingOrigin(origin: string) {
  const o = origin.replace(/\/$/, '')
  if (/www\.okvevo\.com|text2video-16cbf|okvevo-prod/i.test(o)) {
    throw new Error(`refusing production origin: ${o}`)
  }
  if (!/okvevo-testing|localhost|127\.0\.0\.1/i.test(o)) {
    throw new Error(`refusing unknown origin (want staging): ${o}`)
  }
  return o
}

export type Authed = { uid: string; email: string; idToken: string }

type SmokeState = {
  origin: string
  stamp: string
  owner: Authed
  joiner: Authed
  platformAdmin: Authed
  superPublicId: string
  superOrgId: string
  applicationId: string
}

export async function authedJson<T>(
  origin: string,
  idToken: string,
  path: string,
  init: { method?: string; body?: unknown; orgPublicId?: string } = {}
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${origin}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      authorization: `Bearer ${idToken}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.orgPublicId ? { 'x-okvevo-org': init.orgPublicId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as T
  return { status: res.status, json }
}

export async function initAdmin() {
  const key = required('FB_SERVICE_ACCOUNT_KEY')
  const { initializeApp, getApps, cert } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  if (!getApps().length) {
    const sa = JSON.parse(Buffer.from(key, 'base64').toString('utf8'))
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id,
    })
  }
  return getAuth()
}

export async function idTokenFromCustom(apiKey: string, customToken: string): Promise<string> {
  const res = await fetch(`${IDENTITY}:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })
  const json = (await res.json()) as { idToken?: string; error?: { message?: string } }
  if (!res.ok || !json.idToken) {
    throw new Error(`customToken exchange failed: ${json.error?.message ?? res.status}`)
  }
  return json.idToken
}

export async function mintUser(
  adminAuth: Awaited<ReturnType<typeof initAdmin>>,
  apiKey: string,
  email: string
): Promise<Authed> {
  const password = `Smoke-${randomBytes(12).toString('base64url')}`
  let user
  try {
    user = await adminAuth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: 'Staging smoke',
    })
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'auth/email-already-exists') {
      user = await adminAuth.getUserByEmail(email)
      await adminAuth.updateUser(user.uid, { emailVerified: true, password })
    } else {
      throw e
    }
  }
  const custom = await adminAuth.createCustomToken(user.uid)
  const idToken = await idTokenFromCustom(apiKey, custom)
  return { uid: user.uid, email, idToken }
}

function smokeRequestIds(orgId: string) {
  const hex = createHash('sha256').update(orgId).digest('hex').slice(0, 16)
  return {
    topUp: `smoke_seed_${hex}`,
    allocation: `smoke_alloc_${hex}`,
  }
}

/** Manual ops fallback when DATABASE_URL is unset — both buckets get ledger rows. */
function seedSql(orgId: string, topUpAmount: number): string {
  const ids = smokeRequestIds(orgId)
  const exp = new Date(Date.now() + 365 * 864e5).toISOString()
  const periodEnd = new Date(Date.now() + 30 * 864e5).toISOString()
  return `
-- staging-org-smoke seed (safe to re-run: txn ids fixed per org)
-- Prefer: DATABASE_URL=… npx tsx scripts/staging-org-smoke.ts (uses grantCredits)
with w as (
  select id from billing_accounts where owner_org_id = '${orgId}'::uuid
)
insert into credit_transactions (id, billing_account_id, org_id, type, amount, bucket, expires_at, reason, mode)
select '${ids.allocation}', w.id, '${orgId}'::uuid, 'grant', ${SEED_ALLOCATION}, 'allocation', null, 'staging-org-smoke', 'set'
from w
on conflict (id) do nothing;

with w as (
  select id from billing_accounts where owner_org_id = '${orgId}'::uuid
)
insert into credit_transactions (id, billing_account_id, org_id, type, amount, bucket, expires_at, reason)
select '${ids.topUp}', w.id, '${orgId}'::uuid, 'grant', ${topUpAmount}, 'top_up', '${exp}', 'staging-org-smoke'
from w
on conflict (id) do nothing;

update billing_accounts
set allocation_balance = ${SEED_ALLOCATION},
    allocation_granted_total = greatest(coalesce(allocation_granted_total, 0), ${SEED_ALLOCATION}),
    top_up_balance = greatest(top_up_balance, ${topUpAmount}),
    top_up_reference = greatest(top_up_reference, ${topUpAmount}),
    top_up_purchased_total = greatest(coalesce(top_up_purchased_total, 0), ${topUpAmount}),
    plan_status = 'active',
    plan = coalesce(plan, 'starter'),
    credits_included = coalesce(nullif(credits_included, 0), ${SEED_ALLOCATION}),
    current_period_end = '${periodEnd}'::timestamptz,
    updated_at = now()
where owner_org_id = '${orgId}'::uuid;
`.trim()
}

/** Localhost (ssl off, OKVEVO_ENV=local) or the staging project ref. Anything else throws. */
function databaseMode(url: string): { ssl: false | 'require'; env: 'local' | 'staging' } {
  if (/radwdxigdywwdvizczho|okvevo-prod|text2video/i.test(url)) {
    throw new Error('refusing DATABASE_URL that looks like production')
  }
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('refusing DATABASE_URL that is not a URL')
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return { ssl: false, env: 'local' }
  }
  if (url.includes('wnbaxrmnnnfmrquwgsac')) {
    return { ssl: 'require', env: 'staging' }
  }
  throw new Error('refusing DATABASE_URL: not localhost and not the staging project')
}

export async function seedViaDatabase(orgId: string) {
  const url = (process.env.DATABASE_URL ?? '').trim()
  if (!url) return false
  const mode = databaseMode(url)
  process.env.OKVEVO_ENV = mode.env
  const postgres = (await import('postgres')).default
  const lookup = postgres(url, { prepare: false, ssl: mode.ssl, max: 2 })
  let billingAccountId: string
  try {
    const rows = await lookup`
      select id from billing_accounts where owner_org_id = ${orgId} limit 1
    `
    const id = rows[0]?.id as string | undefined
    if (!id) throw new Error(`no billing_accounts row for org ${orgId}`)
    billingAccountId = id
  } finally {
    await lookup.end({ timeout: 2 })
  }

  const { grantCredits } = await import('../src/lib/gateway/debit')
  const ids = smokeRequestIds(orgId)
  const periodEnd = new Date(Date.now() + 30 * 864e5)
  await grantCredits({
    billingAccountId,
    amount: SEED_ALLOCATION,
    bucket: 'allocation',
    mode: 'set',
    reason: 'staging-org-smoke',
    requestId: ids.allocation,
    userPatch: {
      planStatus: 'active',
      plan: 'starter',
      creditsIncluded: SEED_ALLOCATION,
      currentPeriodEnd: periodEnd,
    },
  })
  await grantCredits({
    billingAccountId,
    amount: SEED_TOP_UP,
    bucket: 'topUp',
    reason: 'staging-org-smoke',
    requestId: ids.topUp,
  })
  return true
}

async function finishAfterSeed(state: SmokeState) {
  const { origin, stamp, owner, joiner, superPublicId } = state
  const adminAuth = await initAdmin()

  const child = await authedJson<{
    success?: boolean
    orgPublicId?: string
    error?: string
  }>(origin, owner.idToken, '/api/orgs', {
    body: { name: `Smoke Child ${stamp}`, parent: superPublicId },
    orgPublicId: superPublicId,
  })
  if (child.status !== 200 || !child.json.orgPublicId) {
    throw new Error(`POST /api/orgs child → ${child.status} ${JSON.stringify(child.json)}`)
  }
  const childPublicId = child.json.orgPublicId
  console.log('child: ok', { childPublicId })

  const xfer = await authedJson<{
    success?: boolean
    transferred?: number
    error?: string
  }>(origin, owner.idToken, `/api/orgs/${superPublicId}/transfers`, {
    body: {
      toOrg: childPublicId,
      credits: TRANSFER_CREDITS,
      idempotencyKey: `smoke-xfer-${stamp}`,
    },
    orgPublicId: superPublicId,
  })
  if (xfer.status !== 200 || !xfer.json.success) {
    throw new Error(`POST transfers → ${xfer.status} ${JSON.stringify(xfer.json)}`)
  }
  console.log('transfer: ok', { credits: xfer.json.transferred ?? TRANSFER_CREDITS })

  const join = await authedJson<{ code?: string; error?: string }>(
    origin,
    owner.idToken,
    `/api/orgs/${superPublicId}/join-codes`,
    {
      body: { role: 'member', maxUses: 1 },
      orgPublicId: superPublicId,
    }
  )
  if (join.status !== 200 || !join.json.code) {
    throw new Error(`POST join-codes → ${join.status} ${JSON.stringify(join.json)}`)
  }
  const joinCode = join.json.code
  console.log('join-code: ok', { code: joinCode })

  const redeemed = await authedJson<{ success?: boolean; role?: string; error?: string }>(
    origin,
    joiner.idToken,
    '/api/orgs/join',
    { body: { code: joinCode } }
  )
  if (redeemed.status !== 200 || !redeemed.json.success) {
    throw new Error(`POST /api/orgs/join → ${redeemed.status} ${JSON.stringify(redeemed.json)}`)
  }
  console.log('join: ok', { role: redeemed.json.role })

  const joinerMe = await authedJson<{ memberships?: Array<{ orgPublicId: string }> }>(
    origin,
    joiner.idToken,
    '/api/me'
  )
  const memberOf = (joinerMe.json.memberships ?? []).some((m) => m.orgPublicId === superPublicId)
  if (!memberOf) throw new Error('joiner /api/me missing super-org membership')

  const childSummary = await authedJson<{
    accountKind?: string
    canPurchase?: boolean
    fundedBy?: string | null
  }>(origin, owner.idToken, '/api/billing/summary', { orgPublicId: childPublicId })
  if (childSummary.status !== 200) {
    throw new Error(`child summary → ${childSummary.status}`)
  }
  if (childSummary.json.canPurchase !== false) {
    throw new Error(`expected child canPurchase=false, got ${childSummary.json.canPurchase}`)
  }

  try {
    await adminAuth.deleteUser(owner.uid)
    await adminAuth.deleteUser(joiner.uid)
  } catch (e) {
    console.warn('cleanup users:', (e as Error).message)
  }
  try {
    if (existsSync(STATE_PATH)) writeFileSync(STATE_PATH, '')
  } catch {
    /* ignore */
  }

  console.log('staging-org-smoke: PASS')
  console.log(
    JSON.stringify(
      {
        origin,
        superPublicId,
        childPublicId,
        transferred: TRANSFER_CREDITS,
        joinCode,
        joinerWasMember: memberOf,
        childCanPurchase: childSummary.json.canPurchase,
        childAccountKind: childSummary.json.accountKind,
        fundedBy: childSummary.json.fundedBy ?? null,
      },
      null,
      2
    )
  )
}

async function main() {
  if (process.argv.includes('--continue-after-seed')) {
    if (!existsSync(STATE_PATH)) throw new Error(`missing ${STATE_PATH}`)
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf8')) as SmokeState
    console.log('staging-org-smoke: continue-after-seed')
    await finishAfterSeed(state)
    return
  }

  const origin = assertStagingOrigin(flag('--origin', process.env.STAGING_BASE_URL || DEFAULT_ORIGIN))
  const apiKey = required('NEXT_PUBLIC_FIREBASE_API_KEY')
  const adminEmails = required('ADMIN_EMAILS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!adminEmails.length) throw new Error('ADMIN_EMAILS empty')

  const stamp = Date.now().toString(16)
  const ownerEmail = `smoke-owner-${stamp}@okvevo-smoke-test.invalid`
  const joinerEmail = `smoke-joiner-${stamp}@okvevo-smoke-test.invalid`
  const platformAdminEmail = adminEmails[0]!

  console.log('staging-org-smoke: start')
  console.log(JSON.stringify({ origin, ownerEmail, joinerEmail, platformAdminEmail }, null, 2))

  const adminAuth = await initAdmin()
  const owner = await mintUser(adminAuth, apiKey, ownerEmail)
  const joiner = await mintUser(adminAuth, apiKey, joinerEmail)
  const platformAdmin = await mintUser(adminAuth, apiKey, platformAdminEmail)

  const me = await authedJson<{ user?: { id: string } }>(origin, owner.idToken, '/api/me')
  if (me.status !== 200) throw new Error(`GET /api/me → ${me.status} ${JSON.stringify(me.json)}`)

  const upgraded = await authedJson<{
    success?: boolean
    orgPublicId?: string
    orgId?: string
    error?: string
  }>(origin, owner.idToken, '/api/me/upgrade', {
    body: { name: `Smoke Super ${stamp}` },
  })
  if (upgraded.status !== 200 || !upgraded.json.orgPublicId || !upgraded.json.orgId) {
    throw new Error(`POST /api/me/upgrade → ${upgraded.status} ${JSON.stringify(upgraded.json)}`)
  }
  const superPublicId = upgraded.json.orgPublicId
  const superOrgId = upgraded.json.orgId
  console.log('upgrade: ok', { superPublicId })

  const app = await authedJson<{ ok?: boolean; id?: string; error?: string }>(
    origin,
    owner.idToken,
    '/api/contact',
    {
      body: {
        category: 'super_org_application',
        email: ownerEmail,
        message: 'staging-org-smoke application',
        subjectOrgPublicId: superPublicId,
      },
    }
  )
  if (app.status !== 201 || !app.json.id) {
    throw new Error(`POST /api/contact application → ${app.status} ${JSON.stringify(app.json)}`)
  }
  const applicationId = app.json.id
  console.log('application: ok', { applicationId })

  const approved = await authedJson<{
    success?: boolean
    error?: string
  }>(origin, platformAdmin.idToken, `/api/admin/super-org-applications/${applicationId}/approve`, {
    body: {},
  })
  if (approved.status !== 200 || !approved.json.success) {
    throw new Error(
      `POST approve → ${approved.status} ${JSON.stringify(approved.json)} (is ${platformAdminEmail} in staging ADMIN_EMAILS?)`
    )
  }
  console.log('approve: ok')

  const state: SmokeState = {
    origin,
    stamp,
    owner,
    joiner,
    platformAdmin,
    superPublicId,
    superOrgId,
    applicationId,
  }
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))

  const seeded = await seedViaDatabase(superOrgId)
  if (!seeded) {
    console.log('SEED_REQUIRED')
    console.log(JSON.stringify({ superPublicId, superOrgId, stateFile: STATE_PATH }, null, 2))
    console.log('--- SEED_SQL ---')
    console.log(seedSql(superOrgId, SEED_TOP_UP))
    console.log('After seeding: npx tsx scripts/staging-org-smoke.ts --continue-after-seed')
    process.exit(2)
  }
  console.log('seed: ok', { allocation: SEED_ALLOCATION, topUp: SEED_TOP_UP })
  await finishAfterSeed(state)
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main().catch((err) => {
    console.error('staging-org-smoke: FAIL')
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
