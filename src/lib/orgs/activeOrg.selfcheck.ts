import assert from 'node:assert/strict'
import { resolveActiveOrg } from './activeOrg.ts'

assert.equal(
  resolveActiveOrg({
    stored: null,
    hidePersonal: false,
    upgradedOrgPublicId: null,
    memberships: [{ orgPublicId: 'org_a' }],
  }),
  null
)

assert.equal(
  resolveActiveOrg({
    stored: 'org_a',
    hidePersonal: false,
    upgradedOrgPublicId: null,
    memberships: [{ orgPublicId: 'org_a' }],
  }),
  'org_a'
)

assert.equal(
  resolveActiveOrg({
    stored: 'org_gone',
    hidePersonal: true,
    upgradedOrgPublicId: 'org_up',
    memberships: [{ orgPublicId: 'org_up' }],
  }),
  'org_up'
)

assert.equal(
  resolveActiveOrg({
    stored: null,
    hidePersonal: true,
    upgradedOrgPublicId: 'org_up',
    memberships: [{ orgPublicId: 'org_up' }],
  }),
  'org_up'
)

console.log('activeOrg.selfcheck: ok')
