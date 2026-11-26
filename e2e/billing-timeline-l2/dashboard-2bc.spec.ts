/**
 * Layer 2 (staging): 2b-c dashboard debt copy.
 * Child Billing summary shows overdrawn sentence fields; super-org GET shows Owes + owed total.
 */
import { test, expect } from '@playwright/test'
import {
  getBillingSummary,
  getJoinCode,
  joinWithCode,
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

async function getOrganisations(idToken: string, orgPublicId: string) {
  const res = await fetch(`${L2_ENV.baseUrl}/api/orgs/${orgPublicId}/organisations`, {
    headers: {
      authorization: `Bearer ${idToken}`,
      'x-okvevo-org': orgPublicId,
    },
  })
  const json = (await res.json().catch(() => ({}))) as {
    items?: Array<{ publicId: string; owes?: number }>
  }
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

      const { json: joinMeta, status: joinMetaStatus } = await getJoinCode(
        superUser.idToken,
        superOrgPublicId
      )
      expect(joinMetaStatus).toBe(200)
      expect(joinMeta.code).toBeTruthy()

      const { json: accepted } = await joinWithCode(orgUser.idToken, joinMeta.code!, {
        orgPublicId,
      })
      expect(accepted.success).toBe(true)
      expect(accepted.action).toBe('accept_parent')

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

      // Child rows live on GET …/organisations. Detail no longer returns children.
      const { status: listStatus, json: orgList } = await getOrganisations(
        superUser.idToken,
        superOrgPublicId
      )
      expect(listStatus).toBe(200)
      const child = orgList.items?.find((c) => c.publicId === orgPublicId)
      expect(child).toBeTruthy()
      expect(typeof child!.owes).toBe('number')
      // One child: its Owes amount is the super-org owed total (0 when not overdrawn).
      expect(child!.owes).toBe(exact.owedByOrganisations)
    } finally {
      await deleteTestUser(orgUser)
      await deleteTestUser(superUser)
    }
  })
})
