/**
 * Layer 2 smoke: dashboard shell landmarks after login (no new a11y deps).
 */
import { test, expect } from '@playwright/test'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { L2_ENV } from './env'
import { deleteTestUser, ensureServerUser, type TestUser } from './testUsers'

async function createUiLoginUser(): Promise<TestUser & { password: string }> {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim()
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT required')
  const sa = JSON.parse(raw) as { project_id?: string }
  if (!getApps().length) {
    initializeApp({ credential: cert(sa as never), projectId: sa.project_id })
  }
  // Use a browser-valid email host (not .invalid) so type=email + form submit works.
  const email = `l2-dash-a11y-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.com`
  const password = `L2-${Math.random().toString(36).slice(2)}-${Date.now()}`
  const created = await getAuth().createUser({ email, password, emailVerified: true })
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${L2_ENV.firebaseApiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  const json = (await res.json()) as { idToken?: string; localId?: string }
  if (!res.ok || !json.idToken || !json.localId) {
    throw new Error('createUiLoginUser: signInWithPassword failed')
  }
  if (json.localId !== created.uid) {
    throw new Error('createUiLoginUser: uid mismatch')
  }
  return { uid: created.uid, email, idToken: json.idToken, password }
}

test.describe('dashboard a11y smoke', () => {
  test('main + navigation after login', async ({ page }) => {
    test.setTimeout(90_000)
    if (!(process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim()) {
      test.skip(true, 'FIREBASE_SERVICE_ACCOUNT required for verified UI login')
    }

    const user = await createUiLoginUser()
    try {
      await ensureServerUser(user.idToken)

      await page.goto(`${L2_ENV.baseUrl}/login`, { waitUntil: 'domcontentloaded' })
      await page.locator('#auth-email').fill(user.email)
      await page.locator('#auth-password').fill(user.password)
      // Avoid HTML5 blocking submit; Next client nav does not fire a full "load".
      await page.locator('form').evaluate((f: HTMLFormElement) => {
        f.noValidate = true
      })

      await Promise.all([
        page.waitForURL(
          (url) => {
            const path = url.pathname.replace(/\/$/, '') || '/'
            return path === '/dashboard' || path.startsWith('/dashboard/')
          },
          { timeout: 60_000, waitUntil: 'commit' }
        ),
        page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click(),
      ])

      const main = page.locator('#main, main[role="main"], main').first()
      await expect(main).toBeVisible({ timeout: 30_000 })

      const nav = page.getByRole('navigation', { name: /account/i }).first()
      await expect(nav).toBeVisible({ timeout: 15_000 })
      await expect(
        page.getByRole('link', { name: /overview|billing|profile/i }).first()
      ).toBeVisible()
    } finally {
      await deleteTestUser(user)
    }
  })
})
