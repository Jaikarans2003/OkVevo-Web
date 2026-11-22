/**
 * Approve a pending super-org application by applicant email (staging only).
 *
 * Targets ONLY Supabase okvevo-staging (wnbaxrmnnnfmrquwgsac).
 * Refuses okvevo-prod (radwdxigdywwdvizczho). Never prints secrets.
 *
 *   cd OkVevo-Web
 *   OKVEVO_RESET_TARGET=staging npx tsx scripts/approve-super-org.ts --email user@example.com
 *
 * Uses approveSuperOrgApplication. approved_by = l2-admin@okvevo.com uid (Firebase).
 */

const STAGING_SUPABASE_REF = 'wnbaxrmnnnfmrquwgsac'
const STAGING_SUPABASE_HOST = `db.${STAGING_SUPABASE_REF}.supabase.co`
const PROD_SUPABASE_REF = 'radwdxigdywwdvizczho'
const STAGING_FIREBASE = 'okvevo-testing'
const PROD_FIREBASE = 'text2video-16cbf'
const ADMIN_EMAIL = 'l2-admin@okvevo.com'

function loadEnv() {
  for (const file of ['.env.local', '.env', '.ops-billing-secrets.env'] as const) {
    try {
      process.loadEnvFile(file)
    } catch {
      // optional
    }
  }
}

function dbHost(url: string): string {
  try {
    return new URL(url.replace(/^postgres(ql)?:/i, 'http:')).hostname
  } catch {
    return ''
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i < 0) return undefined
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v.trim() : undefined
}

function assertStagingTargets(opts: {
  databaseUrl: string
  firebaseProjectId: string
}) {
  const host = dbHost(opts.databaseUrl)
  if (!host) throw new Error('refusing: cannot parse DATABASE_URL host')
  if (host.includes(PROD_SUPABASE_REF) || host.includes('okvevo-prod')) {
    throw new Error('refusing: DATABASE_URL points at okvevo-prod')
  }
  if (opts.firebaseProjectId === PROD_FIREBASE) {
    throw new Error(`refusing: Firebase project is ${PROD_FIREBASE}`)
  }
  if (!host.includes(STAGING_SUPABASE_REF) && host !== STAGING_SUPABASE_HOST) {
    throw new Error(
      `refusing: DATABASE_URL host must be staging (${STAGING_SUPABASE_REF}); got host length ${host.length}`
    )
  }
  if (opts.firebaseProjectId !== STAGING_FIREBASE) {
    throw new Error(
      `refusing: Firebase project_id must be ${STAGING_FIREBASE} (got ${opts.firebaseProjectId || 'missing'})`
    )
  }
}

async function main() {
  loadEnv()
  process.env.OKVEVO_ENV = 'staging'

  if (process.env.OKVEVO_RESET_TARGET !== 'staging') {
    console.error('refusing: set OKVEVO_RESET_TARGET=staging')
    process.exit(1)
  }

  const email = (argValue('--email') || '').toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('usage: OKVEVO_RESET_TARGET=staging npx tsx scripts/approve-super-org.ts --email user@example.com')
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

  assertStagingTargets({ databaseUrl, firebaseProjectId })
  process.env.DATABASE_URL = databaseUrl
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = STAGING_FIREBASE

  const { initializeApp, getApps, cert } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  if (!getApps().length) {
    initializeApp({
      credential: cert(sa as never),
      projectId: STAGING_FIREBASE,
    })
  }
  const adminUser = await getAuth().getUserByEmail(ADMIN_EMAIL)
  const approvedBy = adminUser.uid

  const { sql } = await import('../src/lib/db/client.ts')
  const { withTx } = await import('../src/lib/db/tx.ts')
  const { approveSuperOrgApplication } = await import(
    '../src/lib/orgs/approveSuperOrg.ts'
  )

  const apps = await sql`
    select id, email, category, approved_at, user_id
    from contact_submissions
    where category = 'super_org_application'
      and approved_at is null
      and lower(email) = ${email}
    order by created_at desc
  `
  if (apps.length === 0) {
    console.error(`no pending super_org_application for ${email}`)
    await sql.end({ timeout: 1 })
    process.exit(1)
  }
  if (apps.length > 1) {
    console.log(
      JSON.stringify({
        note: 'multiple pending; approving newest',
        count: apps.length,
        ids: apps.map((a) => String(a.id)),
      })
    )
  }

  const applicationId = String(apps[0].id)
  const result = await withTx((tx) =>
    approveSuperOrgApplication(tx, { applicationId, approvedBy })
  )

  console.log(
    JSON.stringify(
      {
        email,
        applicationId,
        approvedByEmail: ADMIN_EMAIL,
        result,
        targets: {
          supabase: `okvevo-staging (${STAGING_SUPABASE_REF})`,
          firebase: STAGING_FIREBASE,
        },
      },
      null,
      2
    )
  )

  if (!result.ok) {
    await sql.end({ timeout: 1 })
    process.exit(1)
  }

  console.log('approve-super-org: ok')
  await sql.end({ timeout: 1 })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
