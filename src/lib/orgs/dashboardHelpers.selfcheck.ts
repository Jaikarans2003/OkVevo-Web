/**
 * Layer 1: dashboard helpers (2b-c). No second overdrawn calculation.
 * Run: npx tsx src/lib/orgs/dashboardHelpers.selfcheck.ts
 */
import assert from 'node:assert/strict'

import {
  availableToSendLabel,
  canChangeMemberRoles,
  canInvitePrivilegedRoles,
  canRemovePrivilegedMembers,
  dashboardNavForRole,
  dashboardNavLabel,
  owedByOrganisationsTotal,
  owesCredits,
  owesPct,
  overdrawnSentence,
  receivedFromSuperOrgLabel,
  transferRepayAddedSplit,
} from './dashboardHelpers.ts'

assert.equal(owesPct(-50, 100), 50)
assert.equal(owesCredits(-40), 40)
assert.equal(owedByOrganisationsTotal([-10, 5, -25, 0]), 35)
assert.equal(owedByOrganisationsTotal([1, 2, 3]), 0)

assert.deepEqual(transferRepayAddedSplit({ transferred: 100, debtRecovered: 40 }), {
  repaid: 40,
  added: 60,
})
assert.deepEqual(transferRepayAddedSplit({ transferred: 20, debtRecovered: 20 }), {
  repaid: 20,
  added: 0,
})
assert.deepEqual(transferRepayAddedSplit({ transferred: 50, debtRecovered: 0 }), {
  repaid: 0,
  added: 50,
})

assert.equal(availableToSendLabel(1200), 'Available to send: 1200 credits')
assert.equal(
  receivedFromSuperOrgLabel({
    total: 100,
    superOrgName: 'Acme Super',
    repaid: 40,
    added: 60,
  }),
  'Received 100 credits from Acme Super (40 repaid, 60 added)'
)
assert.equal(
  overdrawnSentence(50, 'Acme Super'),
  'Overdrawn: 50% of your 1.5% limit used. Ask Acme Super for credits.'
)

assert.equal(dashboardNavForRole('owner'), 'dashboard')
assert.equal(dashboardNavForRole('inherited_read'), 'dashboard')
assert.equal(dashboardNavForRole('member'), 'my_usage')
assert.equal(dashboardNavForRole(null), 'none')
assert.equal(dashboardNavLabel('dashboard'), 'Dashboard')
assert.equal(dashboardNavLabel('my_usage'), 'My usage')

assert.equal(canChangeMemberRoles('owner'), true)
assert.equal(canChangeMemberRoles('member'), false)
assert.equal(canInvitePrivilegedRoles('member'), false)
assert.equal(canInvitePrivilegedRoles('owner'), true)
assert.equal(canRemovePrivilegedMembers('member'), false)
assert.equal(canRemovePrivilegedMembers('platform_admin'), true)

console.log('dashboardHelpers.selfcheck: ok')
