/**
 * Creates the four stable roles and signs each in through /login.
 * The local-only admin gets a new password at the start of every run.
 * l2-admin@okvevo.com is only read (custom token) and never created or updated.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

import { expect, test, type Browser, type Page } from '@playwright/test'

import { L2_ENV } from './env'
import {
  LOCAL_ADMIN,
  PLATFORM_ADMIN,
  assertLocalOrigin,
  assertTestingProject,
  authedJson,
  failApi,
  initAdmin,
  platformAdminToken,
  rotatePassword,
  signInWithPassword,
} from './l2-firebase'
import {
  AUTH_DIR,
  MANIFEST_PATH,
  SECRETS_PATH,
  dumpFirebaseIdb,
  idbHasToken,
  idbPath,
  storagePath,
  type Manifest,
  type RoleName,
} from './session'

const EMAIL = {
  individual: 'l2-individual@okvevo-l2-test.invalid',
  orgOwner: 'l2-org-owner@okvevo-l2-test.invalid',
  superOwner: 'l2-super-owner@okvevo-l2-test.invalid',
  childMember: 'l2-child-d@okvevo-l2-test.invalid',
} as const

type Me = {
  memberships: {
    orgPublicId: string
    name: string
    kind: 'org' | 'super_org'
    role: string
    parent: string | null
  }[]
  hidePersonal: boolean
  upgradedOrgPublicId: string | null
}

function redact(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-url]')
}

function seedSuper(publicId: string) {
  const run = spawnSync('npx', ['tsx', 'e2e/billing-timeline-l2/seed-wallet.ts', publicId], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  })
  if (run.status !== 0) {
    throw new Error(redact(`${run.stderr || ''}\n${run.stdout || ''}`).slice(0, 800))
  }
}

async function signInUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  // "hidden" is true before the client gate mounts, and a click then is a native
  // GET to /login? because the submit handler is not attached yet.
  await page.waitForFunction(() => {
    const el = document.querySelector('#auth-email')
    return !!el && Object.keys(el).some((key) => key.startsWith('__reactProps'))
  }, null, { timeout: 60_000 })
  await page.locator('.ok-loader--full').waitFor({ state: 'hidden', timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.locator('#auth-email').fill(email)
  await page.locator('#auth-password').fill(password)
  const signedIn = page.waitForResponse(
    (res) => res.url().includes('accounts:signInWithPassword'),
    { timeout: 60_000 },
  )
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click()
  const res = await signedIn
  if (!res.ok()) {
    const note = await page.locator('form').innerText()
    const line = note.split('\n').find((row) => /invalid|error|try again/i.test(row)) ?? ''
    throw new Error(`sign-in failed (${res.status()}) ${line}`.trim())
  }
  await page.waitForURL(/\/dashboard/, { timeout: 180_000 })
  await expect
    .poll(async () => idbHasToken(await dumpFirebaseIdb(page)), { timeout: 30_000 })
    .toBe(true)
}

async function saveSession(page: Page, role: RoleName) {
  const rows = await dumpFirebaseIdb(page)
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(idbPath(role), JSON.stringify(rows), { mode: 0o600 })
  await page.context().storageState({ path: storagePath(role) })
  fs.chmodSync(storagePath(role), 0o600)
}

async function saveRole(browser: Browser, role: RoleName, email: string, password: string) {
  const context = await browser.newContext({ baseURL: L2_ENV.baseUrl })
  const page = await context.newPage()
  try {
    await signInUi(page, email, password)
    await saveSession(page, role)
  } finally {
    await context.close()
  }
}

test('provision roles and sign in', async ({ browser }) => {
  test.setTimeout(900_000)
  assertTestingProject()
  const origin = assertLocalOrigin(L2_ENV.baseUrl)
  const admin = await initAdmin()

  const localPassword = await rotatePassword(admin, LOCAL_ADMIN, 'L2 Local Admin')
  await signInWithPassword(LOCAL_ADMIN, localPassword)

  const adminToken = await platformAdminToken(admin)
  if (!adminToken) throw new Error('platform admin token missing')

  const passwords = new Map<RoleName, string>()
  const tokens = new Map<RoleName, string>()
  const people: { role: RoleName; email: string; displayName: string }[] = [
    { role: 'individual', email: EMAIL.individual, displayName: 'L2 Individual' },
    { role: 'orgOwner', email: EMAIL.orgOwner, displayName: 'L2 Org Owner' },
    { role: 'superOwner', email: EMAIL.superOwner, displayName: 'L2 Super Owner' },
    { role: 'childMember', email: EMAIL.childMember, displayName: 'L2 Child D' },
  ]
  for (const person of people) {
    if (person.email === PLATFORM_ADMIN) throw new Error('refusing to rotate l2-admin@okvevo.com')
    const password = await rotatePassword(admin, person.email, person.displayName)
    const signed = await signInWithPassword(person.email, password)
    passwords.set(person.role, password)
    tokens.set(person.role, signed.idToken)
  }

  const api = <T>(role: RoleName, path: string, body?: unknown, orgPublicId?: string) =>
    authedJson<T>(origin, tokens.get(role)!, path, { body, orgPublicId })

  const loadMe = async (role: RoleName) => {
    const res = await api<Me>(role, '/api/me')
    if (res.status !== 200) failApi(`GET /api/me ${role}`, res.status, res.json)
    return res.json
  }

  const individual = await loadMe('individual')
  if (individual.memberships.length > 0 || individual.hidePersonal) {
    throw new Error('individual already has an org; local database was not reset')
  }

  let orgOwnerMe = await loadMe('orgOwner')
  let orgPublicId = orgOwnerMe.upgradedOrgPublicId
  if (orgOwnerMe.memberships.some((m) => m.kind === 'super_org')) {
    throw new Error('org owner account is a super-org')
  }
  if (!orgPublicId) {
    const up = await api<{ orgPublicId?: string }>('orgOwner', '/api/me/upgrade', { name: 'L2 Org' })
    if (up.status === 409) {
      orgOwnerMe = await loadMe('orgOwner')
      orgPublicId = orgOwnerMe.upgradedOrgPublicId
    } else if (up.status !== 200 || !up.json.orgPublicId) {
      failApi('upgrade org owner', up.status, up.json)
    } else {
      orgPublicId = up.json.orgPublicId
    }
  }
  if (!orgPublicId) throw new Error('org owner has no organisation')

  let superMe = await loadMe('superOwner')
  const existingSuper = superMe.memberships.find((m) => m.kind === 'super_org' && m.role === 'owner')
  let superPublicId = existingSuper?.orgPublicId ?? null
  let superName = existingSuper?.name ?? 'L2 Super'
  if (!superPublicId) {
    let subject = superMe.upgradedOrgPublicId
    if (!subject) {
      const up = await api<{ orgPublicId?: string }>('superOwner', '/api/me/upgrade', { name: 'L2 Super' })
      if (up.status === 409) {
        superMe = await loadMe('superOwner')
        subject = superMe.upgradedOrgPublicId
      } else if (up.status !== 200 || !up.json.orgPublicId) {
        failApi('upgrade super owner', up.status, up.json)
      } else {
        subject = up.json.orgPublicId
      }
    }
    if (!subject) throw new Error('super owner has no organisation to apply')
    const contact = await api<{ id?: string }>('superOwner', '/api/contact', {
      category: 'super_org_application',
      email: EMAIL.superOwner,
      message: 'Layer 2 local dashboard check',
      subjectOrgPublicId: subject,
      requestedName: 'L2 Super',
    })
    if (contact.status !== 201 || !contact.json.id) failApi('apply super-org', contact.status, contact.json)
    const approved = await authedJson<{ orgPublicId?: string }>(
      origin,
      adminToken,
      `/api/admin/super-org-applications/${contact.json.id}/approve`,
      { body: {} }
    )
    if (approved.status !== 200 || !approved.json.orgPublicId) {
      failApi('approve super-org', approved.status, approved.json)
    }
    superPublicId = approved.json.orgPublicId
    superName = 'L2 Super'
  }

  const children = await api<{ items?: { publicId: string; name: string }[] }>(
    'superOwner',
    `/api/orgs/${superPublicId}/organisations?sort=name&limit=50`,
    undefined,
    superPublicId
  )
  if (children.status !== 200) failApi('list child orgs', children.status, children.json)
  let childPublicId = children.json.items?.find((item) => item.name === 'L2 Child')?.publicId ?? null
  if (!childPublicId) {
    const created = await api<{ orgPublicId?: string }>(
      'superOwner',
      '/api/orgs',
      { name: 'L2 Child', parent: superPublicId, confirmName: 'L2 Child' },
      superPublicId
    )
    if (created.status !== 200 || !created.json.orgPublicId) {
      failApi('create child org', created.status, created.json)
    }
    childPublicId = created.json.orgPublicId
  }

  seedSuper(superPublicId)

  const transfer = await api(
    'superOwner',
    `/api/orgs/${superPublicId}/transfers`,
    { toOrg: childPublicId, credits: 10_000, idempotencyKey: 'l2-setup-transfer-v1' },
    superPublicId
  )
  if (transfer.status !== 200) failApi('transfer credits', transfer.status, transfer.json)

  const childCode = await api<{ code?: string }>(
    'superOwner',
    `/api/orgs/${childPublicId}/join-codes`,
    undefined,
    childPublicId
  )
  if (childCode.status !== 200 || !childCode.json.code) failApi('child join code', childCode.status, childCode.json)

  const member = await loadMe('childMember')
  if (member.hidePersonal) throw new Error('child member was upgraded')
  if (!member.memberships.some((m) => m.orgPublicId === childPublicId)) {
    const joined = await api('childMember', '/api/orgs/join', { code: childCode.json.code })
    if (joined.status !== 200) failApi('child member join', joined.status, joined.json)
  }

  const superCode = await api<{ code?: string }>(
    'superOwner',
    `/api/orgs/${superPublicId}/join-codes`,
    undefined,
    superPublicId
  )
  if (superCode.status !== 200 || !superCode.json.code) failApi('super join code', superCode.status, superCode.json)

  const manifest: Manifest = {
    individual: { email: EMAIL.individual },
    orgOwner: { email: EMAIL.orgOwner, orgPublicId },
    superOwner: {
      email: EMAIL.superOwner,
      orgPublicId: superPublicId,
      childPublicId,
      superName,
      childName: 'L2 Child',
    },
    childMember: { email: EMAIL.childMember, orgPublicId: childPublicId },
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  fs.writeFileSync(SECRETS_PATH, JSON.stringify({ superJoinCode: superCode.json.code }), { mode: 0o600 })
  console.log(
    `L2_ROLES ${JSON.stringify({
      localAdmin: LOCAL_ADMIN,
      individual: manifest.individual.email,
      orgOwner: manifest.orgOwner,
      superOwner: {
        email: manifest.superOwner.email,
        orgPublicId: manifest.superOwner.orgPublicId,
        childPublicId: manifest.superOwner.childPublicId,
      },
      childMember: manifest.childMember,
    })}`
  )

  for (const person of people) {
    const password = passwords.get(person.role)
    if (!password) throw new Error(`missing password for ${person.role}`)
    await saveRole(browser, person.role, person.email, password)
  }
})
