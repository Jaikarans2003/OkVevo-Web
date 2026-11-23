/**
 * Layer 2 smoke: dashboard shell landmarks after login (no new a11y deps).
 * Uses L2_ADMIN_* (same secrets as approve-super-org) — Firebase client auth
 * against ephemeral @example.com users was flaky in CI; admin is a known
 * working staging login.
 */
import { test, expect } from '@playwright/test'
import { L2_ENV } from './env'

test.describe('dashboard a11y smoke', () => {
  test('main + navigation after login', async ({ page }) => {
    test.setTimeout(90_000)
    const email = (process.env.L2_ADMIN_EMAIL ?? '').trim()
    const password = (process.env.L2_ADMIN_PASSWORD ?? '').trim()
    if (!email || !password) {
      test.skip(true, 'L2_ADMIN_EMAIL / L2_ADMIN_PASSWORD required for UI login')
    }

    await page.goto(`${L2_ENV.baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await page.locator('#auth-email').fill(email)
    await page.locator('#auth-password').fill(password)
    await page.locator('form').evaluate((f: HTMLFormElement) => {
      f.noValidate = true
    })
    await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click()

    // Next client nav does not fire a full "load".
    await page.waitForURL(
      (url) => {
        const path = url.pathname.replace(/\/$/, '') || '/'
        return path === '/dashboard' || path.startsWith('/dashboard/')
      },
      { timeout: 60_000, waitUntil: 'commit' }
    )

    const main = page.locator('#main, main[role="main"], main').first()
    await expect(main).toBeVisible({ timeout: 30_000 })

    await expect(page.getByRole('navigation', { name: /account/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByRole('link', { name: /overview|billing|profile/i }).first()
    ).toBeVisible()
  })
})
