/**
 * Layer 2 smoke: dashboard auth gate + login landmarks.
 * Full signed-in sidebar a11y is covered by DashboardShell (role=navigation)
 * plus check:all selfchecks — Playwright against staging cannot complete
 * Firebase client sign-in in CI (18 other L2 tests are API-only).
 */
import { test, expect } from '@playwright/test'
import { L2_ENV } from './env'

test.describe('dashboard a11y smoke', () => {
  test('signed-out /dashboard reaches login form', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(`${L2_ENV.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#auth-email')).toBeVisible({ timeout: 30_000 })
    await expect(
      page.locator('form').getByRole('button', { name: 'Sign in', exact: true })
    ).toBeVisible()
  })

  test('login page exposes main + Sign in', async ({ page }) => {
    test.setTimeout(30_000)
    await page.goto(`${L2_ENV.baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#main, main').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('#auth-email')).toBeVisible()
    await expect(
      page.locator('form').getByRole('button', { name: 'Sign in', exact: true })
    ).toBeVisible()
  })
})
