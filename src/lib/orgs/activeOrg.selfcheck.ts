/**
 * Layer 1 helper checks for Create organisation under {super-org}.
 * Run: npx tsx src/lib/orgs/activeOrg.selfcheck.ts
 */
import assert from 'node:assert/strict'

import {
  showCreateOrganisationUnder,
  showJoinWithCode,
} from '@/lib/orgs/activeOrg'

const superOrg = {
  orgPublicId: 'sorg_acme',
  kind: 'super_org' as const,
  role: 'owner' as const,
  name: 'Acme Super',
}
const plainOrg = {
  orgPublicId: 'org_studio',
  kind: 'org' as const,
  role: 'owner' as const,
  name: 'Studio',
}

assert.deepEqual(
  showCreateOrganisationUnder({
    activeOrgPublicId: 'sorg_acme',
    upgradedOrgPublicId: 'sorg_acme',
    memberships: [superOrg],
  }),
  { show: true, parentPublicId: 'sorg_acme', name: 'Acme Super' }
)

assert.deepEqual(
  showCreateOrganisationUnder({
    activeOrgPublicId: null,
    upgradedOrgPublicId: 'sorg_acme',
    memberships: [{ ...superOrg, role: 'member' }],
  }),
  { show: false }
)

assert.deepEqual(
  showCreateOrganisationUnder({
    activeOrgPublicId: 'sorg_acme',
    upgradedOrgPublicId: 'sorg_acme',
    memberships: [{ ...superOrg, role: 'member' }],
  }),
  { show: false }
)

assert.deepEqual(
  showCreateOrganisationUnder({
    activeOrgPublicId: 'org_studio',
    upgradedOrgPublicId: 'org_studio',
    memberships: [plainOrg],
  }),
  { show: false }
)

assert.equal(showJoinWithCode(false), true)
assert.equal(showJoinWithCode(true), false)

console.log('activeOrg.selfcheck: ok')
