/**
 * Reset staging user data so QA can retest from scratch.
 *
 * Targets ONLY:
 *   - Supabase okvevo-staging (wnbaxrmnnnfmrquwgsac)
 *   - Firebase okvevo-testing
 *
 * Refuses okvevo-prod (radwdxigdywwdvizczho) and text2video-16cbf.
 * Never prints DATABASE_URL, passwords, or key material.
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/reset-staging.ts
 *   OKVEVO_RESET_TARGET=staging npx tsx scripts/reset-staging.ts --apply
 *
 * Apply order (hard):
 *   1. Cancel Razorpay test subscriptions
 *   2. Wait 10 minutes (late webhooks / resolvePayingWallet)
 *   3. TRUNCATE user-data tables; re-check every table = 0
 *   4. Firebase Auth (keep l2-admin) + Storage deletes
 *   5. Ledger invariant = 0
 */

import Razorpay from 'razorpay'

const STAGING_SUPABASE_REF = 'wnbaxrmnnnfmrquwgsac'
const STAGING_SUPABASE_HOST = `db.${STAGING_SUPABASE_REF}.supabase.co`
const PROD_SUPABASE_REF = 'radwdxigdywwdvizczho'
const STAGING_FIREBASE = 'okvevo-testing'
const PROD_FIREBASE = 'text2video-16cbf'
const KEEP_AUTH_EMAIL = 'l2-admin@okvevo.com'

/** Tables that hold per-user / runtime state — truncated on --apply. */
const USER_DATA_TABLES = [
  'credit_transactions',
  'gateway_jobs',
  'fal_run_idempotency',
  'fal_queues',
  'spend_daily',
  'razorpay_webhook_events',
  'razorpay_subscriptions',
  'desktop_auth_codes',
  'drama_uploads',
  'upload_rate_limits',
  'fal_media_index',
  'cloned_voices',
  'contact_submissions',
  'ops_alerts',
  'admin_rollups',
  'audit_log',
  // org_invitations / invitations / departments dropped in code_join migration
  'join_codes',
  'join_rate_limits',
  'memberships',
  'billing_accounts',
  'organizations',
  'users',
] as const

/** Keep (never truncate): migration history + anything migrations seed as config. */
const CONFIG_TABLES = [
  'schema_migrations', // supabase_migrations.schema_migrations listed separately
] as const

const USER_STORAGE_PREFIXES = ['users/', 'drama-inputs/'] as const

function loadEnv() {
  for (const file of ['.env.local', '.env', '.ops-billing-secrets.env'] as const) {
    try {
      process.loadEnvFile(file)
    } catch {
      // optional
    }
  }
}

function isApply(): boolean {
  return process.argv.includes('--apply')
}

function dbHost(url: string): string {
  try {
    return new URL(url.replace(/^postgres(ql)?:/i, 'http:')).hostname
  } catch {
    return ''
  }
}

function dbUser(url: string): string {
  try {
    return new URL(url.replace(/^postgres(ql)?:/i, 'http:')).username || ''
  } catch {
    return ''
  }
}

/** Direct host contains the staging ref, or exact STAGING_SUPABASE_HOST.
 *  Pooler (IPv4): username must be postgres.<staging-ref> and host must end
 *  in .pooler.supabase.com. Prod ref anywhere in the URL is refused. */
function isStagingDatabaseUrl(url: string): boolean {
  if (url.includes(PROD_SUPABASE_REF) || /okvevo-prod|text2video/i.test(url)) {
    return false
  }
  const host = dbHost(url)
  if (!host) return false
  if (host.includes(STAGING_SUPABASE_REF) || host === STAGING_SUPABASE_HOST) {
    return true
  }
  const user = dbUser(url)
  return (
    user === `postgres.${STAGING_SUPABASE_REF}` &&
    host.endsWith('.pooler.supabase.com')
  )
}

function assertStagingTargets(opts: {
  databaseUrl: string
  firebaseProjectId: string
  razorpayKeyId: string
}) {
  if (opts.databaseUrl.includes(PROD_SUPABASE_REF) || /okvevo-prod/i.test(opts.databaseUrl)) {
    throw new Error('refusing: DATABASE_URL points at okvevo-prod')
  }
  if (opts.firebaseProjectId === PROD_FIREBASE) {
    throw new Error(`refusing: Firebase project is ${PROD_FIREBASE}`)
  }
  if (!isStagingDatabaseUrl(opts.databaseUrl)) {
    const host = dbHost(opts.databaseUrl)
    throw new Error(
      `refusing: DATABASE_URL must be staging direct (${STAGING_SUPABASE_REF}) or pooler user postgres.${STAGING_SUPABASE_REF}; got host length ${host.length}`
    )
  }
  if (opts.firebaseProjectId !== STAGING_FIREBASE) {
    throw new Error(
      `refusing: Firebase project_id must be ${STAGING_FIREBASE} (got ${opts.firebaseProjectId || 'missing'})`
    )
  }
  if (!opts.razorpayKeyId.startsWith('rzp_test_')) {
    throw new Error('refusing: RAZORPAY_KEY_ID is not rzp_test_* (test mode only)')
  }
}

async function listPublicRelations(sql: import('postgres').Sql) {
  return sql`
    select c.relname as name,
           c.relkind as kind,
           coalesce(s.n_live_tup, 0)::bigint as estimate_rows
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_stat_user_tables s on s.relid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'v', 'p')
    order by c.relname
  `
}

async function exactCount(sql: import('postgres').Sql, table: string): Promise<number> {
  // Identifier only from our allow-lists / pg_class — never from argv.
  const rows = await sql.unsafe(`select count(*)::int as n from public.${table}`)
  return Number(rows[0]?.n ?? 0)
}

async function main() {
  loadEnv()
  process.env.OKVEVO_ENV = 'staging'

  const apply = isApply()
  if (apply && process.env.OKVEVO_RESET_TARGET !== 'staging') {
    console.error('refusing --apply: set OKVEVO_RESET_TARGET=staging')
    process.exit(1)
  }

  const databaseUrl = (process.env.DATABASE_URL ?? '').trim()
  if (!databaseUrl) {
    console.error('missing DATABASE_URL (staging pooler / direct URL for okvevo-staging)')
    process.exit(1)
  }

  const key =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY || ''
  if (!key) {
    console.error('missing FIREBASE_SERVICE_ACCOUNT_KEY / FB_SERVICE_ACCOUNT_KEY')
    process.exit(1)
  }
  const sa = JSON.parse(Buffer.from(key, 'base64').toString('utf8')) as {
    project_id?: string
  }
  const firebaseProjectId =
    (sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim()
  const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || '').trim()
  const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim()
  if (!razorpayKeySecret) {
    console.error('missing RAZORPAY_KEY_SECRET')
    process.exit(1)
  }

  assertStagingTargets({ databaseUrl, firebaseProjectId, razorpayKeyId })

  // Force client to use the validated URL (never log it).
  process.env.DATABASE_URL = databaseUrl
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = STAGING_FIREBASE

  const { sql } = await import('../src/lib/db/client.ts')
  const { findLedgerMismatches } = await import('../src/lib/billing/ledgerInvariant.ts')
  const { initializeApp, getApps, cert } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  const { getStorage } = await import('firebase-admin/storage')

  if (!getApps().length) {
    initializeApp({
      credential: cert(sa as never),
      projectId: STAGING_FIREBASE,
      storageBucket:
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        `${STAGING_FIREBASE}.firebasestorage.app`,
    })
  }
  const auth = getAuth()
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${STAGING_FIREBASE}.firebasestorage.app`
  const bucket = getStorage().bucket(bucketName)

  const relations = await listPublicRelations(sql)
  const userSet = new Set<string>(USER_DATA_TABLES)
  const configSet = new Set<string>(CONFIG_TABLES)

  const tableReport: Array<{
    name: string
    kind: string
    class: 'user data' | 'config' | 'view' | 'other'
    rows: number | null
  }> = []

  for (const rel of relations) {
    const name = String(rel.name)
    const kind = String(rel.kind)
    if (kind === 'v') {
      tableReport.push({ name, kind: 'view', class: 'view', rows: null })
      continue
    }
    if (userSet.has(name)) {
      tableReport.push({
        name,
        kind: 'table',
        class: 'user data',
        rows: await exactCount(sql, name),
      })
    } else if (configSet.has(name)) {
      tableReport.push({
        name,
        kind: 'table',
        class: 'config',
        rows: await exactCount(sql, name),
      })
    } else {
      // Unknown public table — treat as user data for safety listing; do not auto-truncate.
      tableReport.push({
        name,
        kind: 'table',
        class: 'other',
        rows: await exactCount(sql, name),
      })
    }
  }

  // Migration history (not in public)
  let migrationRows = 0
  try {
    const m = await sql`
      select count(*)::int as n from supabase_migrations.schema_migrations
    `
    migrationRows = Number(m[0]?.n ?? 0)
  } catch {
    migrationRows = -1
  }

  // Firebase Auth users
  const authUsers: Array<{ uid: string; email: string | undefined }> = []
  let pageToken: string | undefined
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const u of page.users) {
      authUsers.push({ uid: u.uid, email: u.email })
    }
    pageToken = page.pageToken
  } while (pageToken)

  // Razorpay active test subscriptions (from our DB pointers + API status)
  const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  const subRows = await sql`
    select id, status
    from razorpay_subscriptions
    where status is null
       or status not in ('cancelled', 'completed', 'expired')
  `
  const activeSubs: Array<{ id: string; status: string | null }> = []
  for (const row of subRows) {
    const id = String(row.id)
    try {
      const remote = (await razorpay.subscriptions.fetch(id)) as {
        status?: string
      }
      const status = remote.status ?? String(row.status ?? '')
      if (!['cancelled', 'completed', 'expired'].includes(status)) {
        activeSubs.push({ id, status })
      }
    } catch {
      activeSubs.push({ id, status: String(row.status ?? 'fetch_failed') })
    }
  }

  // Storage objects under user paths
  let storageObjects = 0
  for (const prefix of USER_STORAGE_PREFIXES) {
    const [files] = await bucket.getFiles({ prefix, autoPaginate: true })
    storageObjects += files.length
  }

  const keepAuth = authUsers.filter(
    (u) => (u.email || '').toLowerCase() === KEEP_AUTH_EMAIL
  )
  const deleteAuth = authUsers.filter(
    (u) => (u.email || '').toLowerCase() !== KEEP_AUTH_EMAIL
  )

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        targets: {
          supabase: `okvevo-staging (${STAGING_SUPABASE_REF})`,
          firebase: STAGING_FIREBASE,
          storageBucket: bucketName,
          razorpay: 'rzp_test_*',
        },
        tables: tableReport,
        migrations: {
          schema: 'supabase_migrations.schema_migrations',
          class: 'config',
          rows: migrationRows,
        },
        firebaseAuth: {
          total: authUsers.length,
          keep: keepAuth.map((u) => u.email),
          wouldDelete: deleteAuth.length,
        },
        razorpayActiveTestSubscriptions: {
          count: activeSubs.length,
          ids: activeSubs.map((s) => s.id),
        },
        storageUserPathObjects: storageObjects,
        truncateOnApply: USER_DATA_TABLES,
      },
      null,
      2
    )
  )

  if (!apply) {
    console.log(
      'dry-run only; pass --apply with OKVEVO_RESET_TARGET=staging after explicit yes'
    )
    await sql.end({ timeout: 1 })
    return
  }

  // --- apply (order: cancel → wait 10m → truncate → auth/storage → ledger) ---
  console.log('apply: cancelling Razorpay test subscriptions…')
  let cancelled = 0
  for (const sub of activeSubs) {
    try {
      await razorpay.subscriptions.cancel(sub.id, false)
      cancelled += 1
    } catch (err) {
      console.warn(`cancel ${sub.id} failed (continuing)`, err instanceof Error ? err.message : 'error')
    }
  }
  console.log(`apply: cancelled ${cancelled}/${activeSubs.length} subscriptions`)

  const waitMs = 10 * 60 * 1000
  console.log(`apply: waiting ${waitMs / 1000}s for late webhooks…`)
  await new Promise((r) => setTimeout(r, waitMs))
  console.log('apply: wait done')

  console.log('apply: truncating user-data tables…')
  const truncateList = USER_DATA_TABLES.map((t) => `public.${t}`).join(', ')
  await sql.begin(async (tx) => {
    await tx.unsafe(`TRUNCATE ${truncateList} RESTART IDENTITY CASCADE`)
  })
  console.log(`apply: truncated ${USER_DATA_TABLES.length} tables`)

  const leftoverAfterTruncate: Array<{ table: string; rows: number }> = []
  for (const t of USER_DATA_TABLES) {
    const n = await exactCount(sql, t)
    if (n !== 0) leftoverAfterTruncate.push({ table: t, rows: n })
  }
  console.log(
    JSON.stringify({ verifyAfterTruncate: { userDataNonZero: leftoverAfterTruncate } }, null, 2)
  )
  if (leftoverAfterTruncate.length > 0) {
    console.error('verify failed: user-data tables still have rows after truncate')
    process.exit(1)
  }

  console.log('apply: deleting Firebase Auth users (keeping l2-admin)…')
  let authDeleted = 0
  for (const u of deleteAuth) {
    try {
      await auth.deleteUser(u.uid)
      authDeleted += 1
    } catch (err) {
      console.warn(
        `deleteUser failed (continuing)`,
        err instanceof Error ? err.message : 'error'
      )
    }
  }
  console.log(`apply: deleted ${authDeleted} auth users; kept ${keepAuth.length}`)

  console.log('apply: deleting user Storage objects…')
  let storageDeleted = 0
  for (const prefix of USER_STORAGE_PREFIXES) {
    const [files] = await bucket.getFiles({ prefix, autoPaginate: true })
    if (files.length === 0) continue
    await bucket.deleteFiles({ prefix, force: true })
    storageDeleted += files.length
  }
  console.log(`apply: deleted ~${storageDeleted} storage objects`)

  const leftover: Array<{ table: string; rows: number }> = []
  for (const t of USER_DATA_TABLES) {
    const n = await exactCount(sql, t)
    if (n !== 0) leftover.push({ table: t, rows: n })
  }
  const mismatches = await findLedgerMismatches(sql)

  console.log(
    JSON.stringify(
      {
        verify: {
          userDataNonZero: leftover,
          ledgerMismatchCount: mismatches.length,
        },
      },
      null,
      2
    )
  )

  if (leftover.length > 0) {
    console.error('verify failed: user-data tables still have rows')
    process.exit(1)
  }
  if (mismatches.length !== 0) {
    console.error('verify failed: ledger invariant mismatches != 0')
    process.exit(1)
  }

  console.log('reset-staging: ok')
  await sql.end({ timeout: 1 })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
