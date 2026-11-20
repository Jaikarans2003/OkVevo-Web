/**
 * Provision CI-only staging admin for Layer 2 super-org approve.
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/provision-l2-admin.ts
 *
 * Firebase project okvevo-testing only. Creates/updates l2-admin@okvevo.com
 * (emailVerified), pipes password into GitHub Environment staging secrets via
 * `gh secret set … --env staging` stdin. Never prints the password or writes it to disk.
 *
 * Requires: FB_SERVICE_ACCOUNT_KEY (base64 SA JSON for okvevo-testing), gh auth.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const EMAIL = 'l2-admin@okvevo.com'
const PROJECT = 'okvevo-testing'
const REPO = 'Jaikarans2003/OkVevo-Web'
const ENV = 'staging'

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

function required(name: string): string {
  const v = (process.env[name] ?? '').trim()
  if (!v) throw new Error(`missing ${name}`)
  return v
}

function ghSecretSet(name: string, value: string) {
  const res = spawnSync(
    'gh',
    ['secret', 'set', name, '--env', ENV, '--repo', REPO],
    {
      input: value,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  )
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim() || `exit ${res.status}`
    // Never echo stdin/value — only gh's own message.
    throw new Error(`gh secret set ${name} failed: ${err}`)
  }
}

async function main() {
  const key = required('FB_SERVICE_ACCOUNT_KEY')
  const sa = JSON.parse(Buffer.from(key, 'base64').toString('utf8')) as {
    project_id?: string
  }
  if (sa.project_id !== PROJECT) {
    throw new Error(
      `refusing: service account project_id must be ${PROJECT} (got ${sa.project_id ?? 'missing'})`
    )
  }

  const { initializeApp, getApps, cert } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  if (!getApps().length) {
    initializeApp({
      credential: cert(sa as never),
      projectId: PROJECT,
    })
  }
  const auth = getAuth()

  const password = `L2-${randomBytes(24).toString('base64url')}`

  try {
    await auth.createUser({
      email: EMAIL,
      password,
      emailVerified: true,
      displayName: 'Layer 2 CI admin',
    })
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code !== 'auth/email-already-exists') throw e
    const user = await auth.getUserByEmail(EMAIL)
    await auth.updateUser(user.uid, { emailVerified: true, password })
  }

  ghSecretSet('L2_ADMIN_EMAIL', EMAIL)
  ghSecretSet('L2_ADMIN_PASSWORD', password)

  const emailCheck = spawnSync(
    'gh',
    ['secret', 'list', '--env', ENV, '--repo', REPO],
    { encoding: 'utf8' }
  )
  if (emailCheck.status !== 0) {
    throw new Error('gh secret list failed after set')
  }
  const names = (emailCheck.stdout || '')
    .split('\n')
    .map((l) => l.split(/\s+/)[0])
    .filter(Boolean)
  for (const need of ['L2_ADMIN_EMAIL', 'L2_ADMIN_PASSWORD'] as const) {
    if (!names.includes(need)) {
      throw new Error(`secret ${need} not listed on Environment ${ENV}`)
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      email: EMAIL,
      project: PROJECT,
      env: ENV,
      secrets: ['L2_ADMIN_EMAIL', 'L2_ADMIN_PASSWORD'],
    })
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
