/**
 * Layer 2 smoke: dashboard shell landmarks after login (no new a11y deps).
 */
import { test, expect } from '@playwright/test'
import { L2_ENV } from './env'
import { createVerifiedTestUser, deleteTestUser, ensureServerUser } from './testUsers'

test.describe('dashboard a11y smoke', () => {
  test('main + navigation after login', async ({ page }) => {
    test.setTimeout(90_000)
    if (!(process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim()) {
      test.skip(true, 'FIREBASE_SERVICE_ACCOUNT required for verified UI login')
    }

    const user = await createVerifiedTestUser('dash-a11y')
    try {
      await ensureServerUser(user.idToken)

      await page.goto(`${L2_ENV.baseUrl}/login?redirect=/dashboard`, {
        waitUntil: 'domcontentloaded',
      })
      await page.locator('#auth-email').fill(user.email)
      await page.locator('#auth-password').fill(user.password!)
      await page.getByRole('button', { name: /sign in|log in/i }).click()

      // Pathname only — `/login?redirect=/dashboard` must not count as arrived.
      await page.waitForURL(
        (url) => {
          const path = url.pathname.replace(/\/$/, '') || '/'
          return path === '/dashboard' || path.startsWith('/dashboard/')
        },
        { timeout: 60_000 }
      )

      const main = page.locator('#main, main[role="main"], main').first()
      await expect(main).toBeVisible({ timeout: 30_000 })

      const nav = page.getByRole('navigation', { name: /account/i }).first()
      if (await nav.count()) {
        await expect(nav).toBeVisible()
      } else {
        const dashLink = page
          .getByRole('link', { name: /overview|billing|profile|dashboard|usage/i })
          .first()
        await expect(dashLink).toBeVisible({ timeout: 15_000 })
      }
    } finally {
      await deleteTestUser(user)
    }
  })
})