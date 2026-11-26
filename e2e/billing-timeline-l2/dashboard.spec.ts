/**
 * Signed-in org dashboard (plan §7 scenarios 1–10). Serial: member axe and
 * the child jobs run before the role change. Existing fetch specs stay in
 * the staging project and do not use this login.
 */
import { expect, test } from '@playwright/test'

import { runChildJobs } from './child-jobs'
import {
  collectedAxeHits,
  hideLoader,
  readManifest,
  readSecrets,
  restoreFirebaseIdb,
  runAxe,
  storagePath,
  visit,
  type RoleName,
} from './session'

const APPLIED = 'Application sent. We\u2019ll be in touch.'

test.describe('signed-in dashboard', () => {
  test.describe.configure({ mode: 'serial' })

  test.describe('individual', () => {
    test.use({ storageState: storagePath('individual') })
    test.beforeEach(async ({ page }) => {
      await restoreFirebaseIdb(page, 'individual')
    })

    test('scenario 1 apply sends the requested name', async ({ page }) => {
      await page.goto('/dashboard/personal/account-type')
      await hideLoader(page)
      await page.getByLabel('Super-organisation name').fill('L2 Apply Only')
      await page.getByLabel('Why do you need a super-organisation?').fill('Layer 2 checks the apply form.')
      const req = page.waitForRequest((r) => r.url().includes('/api/contact') && r.method() === 'POST')
      await page.getByRole('button', { name: 'Submit application' }).click()
      const body = (await req).postDataJSON() as { requestedName?: string }
      expect(body.requestedName).toBe('L2 Apply Only')
      await expect(page.getByText(APPLIED)).toBeVisible()
    })

    test('scenario 3 create_org_first dialog', async ({ page }) => {
      const code = readSecrets().superJoinCode
      await page.goto('/dashboard/personal/organisations')
      await hideLoader(page)
      await page.getByPlaceholder('e.g. OKV-\u2026').fill(code)
      await page.getByRole('button', { name: 'Join', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: 'Create your organisation first' })).toBeVisible()
      await expect(page.getByText('create_org_first')).toHaveCount(0)
      await dialog.getByRole('button', { name: 'Create', exact: true }).click()
      await page.waitForURL(/\/dashboard\/personal\/account-type/)
    })

    test('scenario 10 personal deep links keep the query', async ({ page }) => {
      await page.goto('/dashboard/billing?plan=pro')
      await page.waitForURL(/\/dashboard\/personal\/billing\?plan=pro/)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard\/personal\/?$/)
    })

    test('personal tabs, billing tabs, and axe', async ({ page }) => {
      await visit(page, '/dashboard/personal', 'Overview')
      await visit(page, '/dashboard/personal/usage', 'Usage')
      for (const tab of ['transactions', 'usage', 'credits', 'payments']) {
        await visit(page, `/dashboard/personal/billing/${tab}`, 'Billing')
      }
      await visit(page, '/dashboard/personal/organisations', 'Organisations')
      await visit(page, '/dashboard/personal/account-type', 'Account type')
      await page.goto('/dashboard/profile')
      await hideLoader(page)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await runAxe(page, '/dashboard/profile')
    })

    test('scenario 7 sidebar clicks do not show the full-screen loader', async ({ page }) => {
      await page.goto('/dashboard/personal')
      await hideLoader(page)
      await expect(page.locator('.ok-loader--full')).toBeHidden()
      await page.evaluate(() => {
        ;(window as unknown as { __l2?: number }).__l2 = 1
      })
      const sidebar = page.locator('[data-sidebar="sidebar"]:visible')
      for (const name of ['Usage', 'Billing', 'Organisations', 'Account type', 'Overview']) {
        await sidebar.getByRole('link', { name, exact: true }).click()
        await expect(page.locator('.ok-loader--full')).toBeHidden()
        expect(await page.evaluate(() => (window as unknown as { __l2?: number }).__l2)).toBe(1)
      }
    })
  })

  test.describe('org owner', () => {
    test.use({ storageState: storagePath('orgOwner') })
    test.beforeEach(async ({ page }) => {
      await restoreFirebaseIdb(page, 'orgOwner')
    })

    test('org owner tabs and axe', async ({ page }) => {
      const id = readManifest().orgOwner.orgPublicId
      const base = `/dashboard/o/${id}`
      await visit(page, base, 'Overview')
      await visit(page, `${base}/members`, 'Members')
      await visit(page, `${base}/usage`, 'Usage')
      await page.getByRole('tab', { name: 'Jobs' }).click()
      await runAxe(page, `${base}/usage#jobs`)
      for (const tab of ['transactions', 'credits', 'payments']) {
        await visit(page, `${base}/billing/${tab}`, 'Billing')
      }
      await visit(page, `${base}/settings`, 'Settings')
      for (const tab of ['Super-organisation', 'Activity', 'Danger zone']) {
        await page.getByRole('tab', { name: tab }).click()
        await runAxe(page, `${base}/settings#${tab}`)
      }
    })

    test('scenario 2 org joins a super-org without a reload', async ({ page }) => {
      const manifest = readManifest()
      const code = readSecrets().superJoinCode
      const base = `/dashboard/o/${manifest.orgOwner.orgPublicId}/settings`
      await page.goto(base)
      await hideLoader(page)
      await page.getByRole('tab', { name: 'Super-organisation' }).click()
      const badge = page.getByText(`Part of ${manifest.superOwner.superName}`)
      if (await badge.isVisible().catch(() => false)) {
        await expect(badge).toBeVisible()
        return
      }
      await page.evaluate(() => {
        ;(window as unknown as { __l2?: number }).__l2 = 1
      })
      const url = page.url()
      await page.locator('#join-code').fill(code)
      await page.locator('form').filter({ has: page.locator('#join-code') }).getByRole('button', { name: 'Join', exact: true }).click()
      await expect(badge).toBeVisible()
      expect(page.url()).toBe(url)
      expect(page.url()).toContain(`/dashboard/o/${manifest.orgOwner.orgPublicId}`)
      expect(await page.evaluate(() => (window as unknown as { __l2?: number }).__l2)).toBe(1)
    })

    test('scenario 4 leave returns the org to Independent', async ({ page }) => {
      const id = readManifest().orgOwner.orgPublicId
      await page.goto(`/dashboard/o/${id}/settings`)
      await hideLoader(page)
      await page.getByRole('tab', { name: 'Super-organisation' }).click()
      await page.getByRole('button', { name: 'Leave super-organisation' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Leave', exact: true }).click()
      await page.goto(`/dashboard/o/${id}`)
      await hideLoader(page)
      await expect(page.getByText('Independent', { exact: true })).toBeVisible()
    })

    test('scenario 10 org deep links keep the query', async ({ page }) => {
      const id = readManifest().orgOwner.orgPublicId
      await page.goto('/dashboard/billing?plan=pro')
      await page.waitForURL(new RegExp(`/dashboard/o/${id}/billing\\?plan=pro`))
      await page.goto('/dashboard')
      await expect(page).toHaveURL(new RegExp(`/dashboard/o/${id}/?$`))
    })
  })

  test.describe('super owner', () => {
    test.use({ storageState: storagePath('superOwner') })
    test.beforeEach(async ({ page }) => {
      await restoreFirebaseIdb(page, 'superOwner')
    })

    test('super-org tabs and axe', async ({ page }) => {
      const id = readManifest().superOwner.orgPublicId
      const base = `/dashboard/o/${id}`
      await visit(page, base, 'Overview')
      await visit(page, `${base}/organisations`, 'Organisations')
      await visit(page, `${base}/credits`, 'Credits')
      await visit(page, `${base}/usage`, 'Usage')
      await page.getByRole('tab', { name: 'Jobs' }).click()
      await runAxe(page, `${base}/usage#jobs`)
      for (const tab of ['transactions', 'credits', 'payments']) {
        await visit(page, `${base}/billing/${tab}`, 'Billing')
      }
      await visit(page, `${base}/settings`, 'Settings')
      for (const tab of ['Join code', 'Activity']) {
        await page.getByRole('tab', { name: tab }).click()
        await runAxe(page, `${base}/settings#${tab}`)
      }
      await page.goto('/dashboard/profile')
      await hideLoader(page)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await runAxe(page, '/dashboard/profile')
    })

    test('scenario 10 super-org deep links keep the query', async ({ page }) => {
      const id = readManifest().superOwner.orgPublicId
      await page.goto('/dashboard/billing?plan=pro')
      await page.waitForURL(new RegExp(`/dashboard/o/${id}/billing\\?plan=pro`))
      await page.goto('/dashboard')
      await expect(page).toHaveURL(new RegExp(`/dashboard/o/${id}/?$`))
    })

    test('scenario 5 send credits, rename, and activity', async ({ page }) => {
      const manifest = readManifest()
      const id = manifest.superOwner.orgPublicId
      await page.goto(`/dashboard/o/${id}/credits`)
      await hideLoader(page)
      await page.getByRole('button', { name: 'Send credits' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.locator('#send-search').fill(manifest.superOwner.childName)
      await dialog.getByRole('option', { name: manifest.superOwner.childName }).click()
      await dialog.locator('#send-amount').fill('100')
      await dialog.getByRole('button', { name: 'Send credits' }).click()
      await expect(dialog).toBeHidden()

      await page.goto(`/dashboard/o/${id}/settings`)
      await hideLoader(page)
      await page.getByRole('button', { name: 'Rename' }).click()
      await page.locator('#super-rename').fill('L2 Super Renamed')
      await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
      await expect(page.getByLabel('General').getByText('L2 Super Renamed')).toBeVisible()
      await page.getByRole('tab', { name: 'Activity' }).click()
      await expect(page.getByText(/Sent 100 credits to /).first()).toBeVisible()
      await expect(page.getByText(/Renamed .+ to L2 Super Renamed/).first()).toBeVisible()
    })
  })

  test.describe('child member', () => {
    test.use({ storageState: storagePath('childMember') })
    test.beforeEach(async ({ page }) => {
      await restoreFirebaseIdb(page, 'childMember')
    })

    test('member tabs and axe before the role change', async ({ page }) => {
      const id = readManifest().childMember.orgPublicId
      const base = `/dashboard/o/${id}`
      await visit(page, base, 'Overview')
      await visit(page, `${base}/my-usage`, 'My usage')
      await page.getByRole('tab', { name: 'Jobs' }).click()
      await runAxe(page, `${base}/my-usage#jobs`)
      await visit(page, `${base}/organisation`, 'Organisation')
      await page.goto('/dashboard/profile')
      await hideLoader(page)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await runAxe(page, '/dashboard/profile')
    })

    test('scenario 10 member deep link stays personal', async ({ page }) => {
      await page.goto('/dashboard/billing?plan=pro')
      await page.waitForURL(/\/dashboard\/personal\/billing\?plan=pro/)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard\/personal\/?$/)
    })

    test('scenario 5 child jobs show model and job type', async ({ page }) => {
      test.setTimeout(600_000)
      const id = readManifest().childMember.orgPublicId
      await page.goto(`/dashboard/o/${id}/my-usage`)
      await hideLoader(page)
      const cost = await runChildJobs(page, id)
      await page.goto(`/dashboard/o/${id}/my-usage`)
      await hideLoader(page)
      await page.getByRole('tab', { name: 'Jobs' }).click()
      expect(cost.jobs?.some((row) => row.jobType === 'Audio')).toBeFalsy()
      for (const type of ['Chat', 'Search', 'Image', 'Video'] as const) {
        const leg = type === 'Chat' ? cost.chat : type === 'Search' ? cost.search : type === 'Image' ? cost.image : cost.video
        if (!leg?.settled) continue
        const item = cost.jobs?.find((row) => row.jobType === type && row.modelLabel)
        expect(item, `${type} job`).toBeTruthy()
        await expect(page.getByRole('cell', { name: item!.modelLabel, exact: true }).first()).toBeVisible()
        await expect(page.getByRole('cell', { name: type, exact: true }).first()).toBeVisible()
      }
    })
  })

  test.describe('role change', () => {
    test.use({ storageState: storagePath('superOwner') })
    test.beforeEach(async ({ page }) => {
      await restoreFirebaseIdb(page, 'superOwner' satisfies RoleName)
    })

    test('scenario 6 member becomes owner without a reload', async ({ page }) => {
      const manifest = readManifest()
      await page.goto(`/dashboard/o/${manifest.superOwner.childPublicId}/members`)
      await hideLoader(page)
      await page.evaluate(() => {
        ;(window as unknown as { __l2?: number }).__l2 = 1
      })
      const row = page.getByRole('row').filter({ hasText: manifest.childMember.email })
      await row.getByRole('button', { name: /Actions for / }).click()
      const response = page.waitForResponse(
        (r) => r.url().includes('/members/') && r.request().method() === 'PATCH'
      )
      await page.getByRole('menuitem', { name: 'Make owner' }).click()
      expect((await response).ok()).toBeTruthy()
      await expect(row.getByText('owner', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => (window as unknown as { __l2?: number }).__l2)).toBe(1)
    })
  })

  test('axe serious and critical', () => {
    expect(collectedAxeHits()).toEqual([])
  })
})
