/**
 * Super-org application + approval against local Supabase.
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.ADMIN_EMAILS = 'admin@okvevo.com'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const { ensureUserAndBilling, getBillingByOrgId } = await import('@/lib/db/wallet')
const { insertSuperOrgApplication } = await import('@/lib/api/contact')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const { approveSuperOrgApplication } = await import('@/lib/orgs/approveSuperOrg')
const { isPlatformAdmin } = await import('@/lib/api/me')

assert.equal(isPlatformAdmin({ email: 'admin@okvevo.com', email_verified: true }), true)

const uid = `app-${Date.now().toString(16)}`
const admin = `adm-${Date.now().toString(16)}`
await ensureUserAndBilling(sql, uid)
await ensureUserAndBilling(sql, admin)

// Individual → approve creates super_org in one step
const app1 = await insertSuperOrgApplication({
  userId: uid,
  email: 'user@example.com',
  message: 'Please make us a super org',
})
assert.ok(app1.ok)
if (!app1.ok) throw new Error('insert app')

const approved = await withTx((tx) =>
  approveSuperOrgApplication(tx, { applicationId: app1.id, approvedBy: admin })
)
assert.ok(approved.ok)
if (!approved.ok) throw new Error('approve')
assert.equal(approved.created, true)
assert.match(approved.orgPublicId, /^sorg_/)

const billing = await getBillingByOrgId(sql, approved.orgId)
assert.equal(billing?.accountKind, 'super_org')
assert.equal(billing?.accessMode, 'subscription')

// Second approve → already_approved
const again = await withTx((tx) =>
  approveSuperOrgApplication(tx, { applicationId: app1.id, approvedBy: admin })
)
assert.equal(again.ok, false)
if (!again.ok) assert.equal(again.code, 'already_approved')

// Org subject: upgrade then apply then approve
const uid2 = `app2-${Date.now().toString(16)}`
await ensureUserAndBilling(sql, uid2)
const org = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: uid2, name: 'OrgCo', kind: 'org' })
)
assert.ok(org.ok)
if (!org.ok) throw new Error('upgrade')

const needsOrg = await insertSuperOrgApplication({
  userId: uid2,
  email: 'o@example.com',
  message: 'promote',
})
assert.equal(needsOrg.ok, false)
if (!needsOrg.ok) assert.equal(needsOrg.code, 'already_upgraded_needs_org')

const app2 = await insertSuperOrgApplication({
  userId: uid2,
  email: 'o@example.com',
  message: 'promote',
  subjectOrgPublicId: org.orgPublicId,
})
assert.ok(app2.ok)
if (!app2.ok) throw new Error('app2')

const approved2 = await withTx((tx) =>
  approveSuperOrgApplication(tx, { applicationId: app2.id, approvedBy: admin })
)
assert.ok(approved2.ok)
if (!approved2.ok) throw new Error('approve2')
assert.equal(approved2.created, false)
assert.equal(approved2.orgPublicId, org.orgPublicId)
assert.equal((await getBillingByOrgId(sql, org.orgId))?.accountKind, 'super_org')

console.log('approveSuperOrg.ledgercheck: ok')
await sql.end({ timeout: 1 })
