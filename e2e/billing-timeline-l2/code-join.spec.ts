/**
 * Layer 2 (staging): code join — member via org code; super code → create_org_first for individuals.
 */
import { test, expect } from '@playwright/test'
import { getJoinCode, joinWithCode, upgradeToOrg, approveSuperOrg, applySuperOrg } from './apiClient'
import { L2_ENV } from './env'
import { createTestUser, deleteTestUser, ensureServerUser } from './testUsers'

test.describe('code join API', () => {
  test('individual joins org via org code', async () => {
    test.setTimeout(120_000)
    const owner = await createTestUser('code-join-owner')
    const member = await createTestUser('code-join-member')
    try {
      await ensureServerUser(owner.idToken)
      await ensureServerUser(member.idToken)

      const { json: upgraded } = await upgradeToOrg(owner.idToken, 'L2 Code Join Org')
      expect(upgraded.success).toBe(true)
      const orgPublicId = upgraded.orgPublicId!

      const { status, json: meta } = await getJoinCode(owner.idToken, orgPublicId)
      expect(status).toBe(200)
      expect(meta.code).toBeTruthy()

      const { status: joinStatus, json: joined } = await joinWithCode(member.idToken, meta.code!)
      expect(joinStatus).toBe(200)
      expect(joined.success).toBe(true)
      expect(joined.action).toBe('join_member')
      expect(joined.orgPublicId).toBe(orgPublicId)
    } finally {
      await deleteTestUser(owner)
      await deleteTestUser(member)
    }
  })

  test('individual with super code gets create_org_first', async () => {
    test.setTimeout(180_000)
    const adminEmail = (process.env.L2_ADMIN_EMAIL ?? '').trim()
    const adminPassword = (process.env.L2_ADMIN_PASSWORD ?? '').trim()
    if (!adminEmail || !adminPassword) {
      test.skip(true, 'missing L2_ADMIN_EMAIL / L2_ADMIN_PASSWORD')
    }

    const applicant = await createTestUser('code-super-ind')
    const superUser = await createTestUser('code-super-own')
    try {
      await ensureServerUser(applicant.idToken)
      await ensureServerUser(superUser.idToken)

      const { json: app } = await applySuperOrg(
        superUser.idToken,
        'L2 super code join',
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

      const { json: meta } = await getJoinCode(superUser.idToken, superOrgPublicId)
      expect(meta.code).toBeTruthy()

      const { status, json: body } = await joinWithCode(applicant.idToken, meta.code!)
      expect(status).toBe(422)
      expect(body.code).toBe('create_org_first')
    } finally {
      await deleteTestUser(applicant)
      await deleteTestUser(superUser)
    }
  })
})