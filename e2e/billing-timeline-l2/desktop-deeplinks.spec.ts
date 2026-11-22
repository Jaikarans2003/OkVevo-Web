/**
 * Layer 2: legacy /billing paths → permanent redirect to /dashboard/billing/* (308).
 */
import { test, expect } from '@playwright/test'
import { L2_ENV } from './env'

const BILLING_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: '/billing', to: '/dashboard/billing' },
  { from: '/billing/plans', to: '/dashboard/billing/plans' },
  { from: '/billing/change-plan', to: '/dashboard/billing/change-plan' },
  { from: '/billing/cancel', to: '/dashboard/billing/cancel' },
  { from: '/billing/upgrade', to: '/dashboard/billing/upgrade' },
]

test.describe('billing deeplinks', () => {
  for (const { from, to } of BILLING_REDIRECTS) {
    test(`${from} → 308 ${to}`, async () => {
      const qs = from.includes('change-plan') ? '?plan=pro' : ''
      const res = await fetch(`${L2_ENV.baseUrl}${from}${qs}`, { redirect: 'manual' })
      expect(res.status).toBe(308)
      const location = res.headers.get('location') ?? ''
      expect(location).toContain(to)
      if (qs) expect(location).toContain('plan=pro')
    })
  }

  test('/pricing GET 200 signed out', async () => {
    const res = await fetch(`${L2_ENV.baseUrl}/pricing`, { redirect: 'manual' })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/Starter|Pro|Max/i)
  })
})