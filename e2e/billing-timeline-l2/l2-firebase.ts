/**
 * Firebase helpers for the dashboard setup process. Does not import the
 * smoke script (that pulls server code Playwright cannot bundle). Wallet
 * seed goes through seed-wallet.ts, which calls seedViaDatabase.
 *
 * Password changes are refused for l2-admin@okvevo.com.
 */
import { randomBytes } from 'node:crypto'

import { L2_ENV } from './env'

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts'

export const PLATFORM_ADMIN = 'l2-admin@okvevo.com'
export const LOCAL_ADMIN = 'l2-local-admin@okvevo-l2-test.invalid'

export function assertLocalOrigin(origin: string): string {
  const o = origin.replace(/\/$/, '')
  if (/www\.okvevo\.com|text2video-16cbf|okvevo-prod/i.test(o)) {
    throw new Error('refusing production origin')
  }
  if (!/okvevo-testing|localhost|127\.0\.0\.1/i.test(o)) {
    throw new Error('refusing unknown origin')
  }
  return o
}

export function assertTestingProject(): void {
  const raw = (process.env.FB_SERVICE_ACCOUNT_KEY ?? '').trim()
  if (!raw) throw new Error('missing env FB_SERVICE_ACCOUNT_KEY')
  const sa = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as { project_id?: string }
  if (sa.project_id !== 'okvevo-testing') {
    throw new Error(`refusing firebase project ${sa.project_id ?? 'unknown'}`)
  }
}

type AdminAuth = {
  createUser: (p: { email: string; password: string; emailVerified: boolean; displayName: string }) => Promise<{ uid: string }>
  getUserByEmail: (email: string) => Promise<{ uid: string }>
  updateUser: (uid: string, p: { emailVerified?: boolean; password?: string; displayName?: string }) => Promise<unknown>
  createCustomToken: (uid: string) => Promise<string>
}

export async function initAdmin(): Promise<AdminAuth> {
  const key = (process.env.FB_SERVICE_ACCOUNT_KEY ?? '').trim()
  if (!key) throw new Error('missing env FB_SERVICE_ACCOUNT_KEY')
  const { initializeApp, getApps, cert } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  if (!getApps().length) {
    const sa = JSON.parse(Buffer.from(key, 'base64').toString('utf8'))
    initializeApp({ credential: cert(sa), projectId: sa.project_id })
  }
  return getAuth() as unknown as AdminAuth
}

export async function idTokenFromCustom(customToken: string): Promise<string> {
  const res = await fetch(`${IDENTITY}:signInWithCustomToken?key=${L2_ENV.firebaseApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })
  const json = (await res.json()) as { idToken?: string; error?: { message?: string } }
  if (!res.ok || !json.idToken) {
    throw new Error(`custom token exchange failed: ${json.error?.message ?? res.status}`)
  }
  return json.idToken
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(`${IDENTITY}:signInWithPassword?key=${L2_ENV.firebaseApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const json = (await res.json()) as {
    localId?: string
    idToken?: string
    error?: { message?: string }
  }
  if (!res.ok || !json.idToken || !json.localId) {
    throw new Error(`sign-in failed for ${email}: ${json.error?.message ?? res.status}`)
  }
  return { uid: json.localId, idToken: json.idToken }
}

/** Fresh password every call. Never for the platform admin. */
export async function rotatePassword(
  admin: AdminAuth,
  email: string,
  displayName: string
): Promise<string> {
  if (email.toLowerCase() === PLATFORM_ADMIN) {
    throw new Error('refusing to create or change the password of l2-admin@okvevo.com')
  }
  const password = `L2-${randomBytes(18).toString('base64url')}`
  try {
    await admin.createUser({ email, password, emailVerified: true, displayName })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code !== 'auth/email-already-exists') throw err
    const user = await admin.getUserByEmail(email)
    await admin.updateUser(user.uid, { emailVerified: true, password, displayName })
  }
  return password
}

export async function platformAdminToken(admin: AdminAuth): Promise<string> {
  let user: { uid: string }
  try {
    user = await admin.getUserByEmail(PLATFORM_ADMIN)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/user-not-found') {
      throw new Error('l2-admin@okvevo.com is missing; refusing to create it')
    }
    throw err
  }
  const custom = await admin.createCustomToken(user.uid)
  return idTokenFromCustom(custom)
}

export async function authedJson<T>(
  origin: string,
  idToken: string,
  path: string,
  init: { body?: unknown; orgPublicId?: string } = {}
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${origin}${path}`, {
    method: init.body !== undefined ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${idToken}`,
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init.orgPublicId ? { 'x-okvevo-org': init.orgPublicId } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as T
  return { status: res.status, json }
}

export function failApi(what: string, status: number, json: unknown): never {
  const body = json as { error?: unknown; code?: unknown }
  const code =
    typeof body?.code === 'string' ? body.code : typeof body?.error === 'string' ? body.error : ''
  throw new Error(`${what} → ${status} ${code}`.trim())
}
