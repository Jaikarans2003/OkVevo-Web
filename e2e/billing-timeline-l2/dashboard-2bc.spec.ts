/**
 * Layer 2 (staging): 2b-c dashboard debt copy.
 * Child Billing summary shows overdrawn sentence fields; super-org GET shows Owes + owed total.
 */
import { test, expect } from '@playwright/test'
import {
  acceptParent,
  getBillingSummary,
  inviteExistingOrg,
  upgradeToOrg,
  approveSuperOrg,
  applySuperOrg,
} from './apiClient'
import { L2_ENV } from './env'
import {
  createTestUser,
  deleteTestUser,
  ensureServerUser,
} from './testUsers'

async function getOrgDashboard(idToken: string, orgPublicId: string) {
  const res = await fetch(`${L2_ENV.baseUrl}/api/orgs/${orgPublicId}`, {
    headers: {
      authorization: `Bearer ${idToken}`,
      'x-okvevo-org': orgPublicId,
    },
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

test.describe('2b-c dashboards', () => {
  test('overdrawn sentence on child summary; Owes on super-org organisations', async () => {
    test.setTimeout(180_000)
    const adminEmail = (process.env.L2_ADMIN_EMAIL ?? '').trim()
    const adminPassword = (process.env.L2_ADMIN_PASSWORD ?? '').trim()
    if (!adminEmail || !adminPassword) {
      throw new Error('billing-timeline-l2: missing L2_ADMIN_EMAIL / L2_ADMIN_PASSWORD')
    }

    const orgUser = await createTestUser('2bc-org')
    const superUser = await createTestUser('2bc-super')
    try {
      await ensureServerUser(orgUser.idToken)
      await ensureServerUser(superUser.idToken)

      const { json: upgraded } = await upgradeToOrg(orgUser.idToken, 'L2 2bc Org')
      expect(upgraded.success).toBe(true)
      const orgPublicId = upgraded.orgPublicId!

      const { json: app } = await applySuperOrg(
        superUser.idToken,
        'L2 2bc super',
        `${superUser.uid}@example.com`
      )
      expect(app.ok).toBe(true)

      const adminTokenRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${L2_ENV.firebaseApiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
            returnSecureToken: true,
          }),
        }
      )
      const adminJson = (await adminTokenRes.json()) as { idToken?: string }
      expect(adminJson.idToken).toBeTruthy()
      const { json: approved } = await approveSuperOrg(adminJson.idToken!, app.id!)
      expect(approved.success).toBe(true)
      const superOrgPublicId = approved.orgPublicId!

      const { json: orgInvite } = await inviteExistingOrg(
        superUser.idToken,
        superOrgPublicId,
        { orgPublicId }
      )
      expect(orgInvite.success).toBe(true)

      const { json: accepted } = await acceptParent(
        orgUser.idToken,
        orgPublicId,
        superOrgPublicId
      )
      expect(accepted.success).toBe(true)

      // Drive child sponsored negative via admin SQL is not available in L2;
      // assert API shapes that power the dashboard copy when overdrawnPct > 0.
      const { json: summary } = await getBillingSummary(orgUser.idToken, { orgPublicId })
      expect(summary.canPurchase).toBe(false)
      expect(summary.fundedBy).toBeTruthy()
      expect(typeof summary.sponsoredPct).toBe('number')
      // overdrawnPct is on BillingSummary; BillingSnapshot now carries it for UI sentence.
      expect(typeof (summary as { overdrawnPct?: number }).overdrawnPct).toBe('number')

      const { status, json: superDash } = await getOrgDashboard(
        superUser.idToken,
        superOrgPublicId
      )
      expect(status).toBe(200)
      expect(superDash.exact).toBeTruthy()
      const exact = superDash.exact as {
        owedByOrganisations: number
        availableToSend: number
        availableToSendLabel: string
      }
      expect(typeof exact.owedByOrganisations).toBe('number')
      expect(typeof exact.availableToSend).toBe('number')
      expect(exact.availableToSendLabel).toMatch(/Available to send:/)

      const children = superDash.children as Array<{
        publicId: string
        owesPct?: number
        owesCredits?: number
      }>
      const child = children.find((c) => c.publicId === orgPublicId)
      expect(child).toBeTruthy()
      expect(typeof child!.owesPct).toBe('number')
      expect(typeof child!.owesCredits).toBe('number')
      // When not overdrawn, both are 0; UI still renders credits + %.
      expect(child!.owesCredits).toBe(exact.owedByOrganisations)
    } finally {
      await deleteTestUser(orgUser)
      await deleteTestUser(superUser)
    }
  })
})
