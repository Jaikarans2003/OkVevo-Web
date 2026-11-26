/**
 * CSV escaping and activity wording. No database.
 * Run: npx tsx src/lib/analytics/analytics.selfcheck.ts
 */
import assert from 'node:assert/strict'

import { activityWording, actorLabel } from '@/lib/analytics/activityCopy'
import { csvCell, csvLine } from '@/lib/analytics/csv'
import { releaseReasonWording } from '@/lib/analytics/releaseReasonCopy'

assert.equal(csvCell('=cmd'), `"'=cmd"`)
assert.equal(csvCell('+1'), `"'+1"`)
assert.equal(csvCell('-name'), `"'-name"`)
assert.equal(csvCell('@x'), `"'@x"`)
assert.equal(csvCell('Acme "Studio"'), `"Acme ""Studio"""`)
assert.equal(csvCell(-12, 'number'), '"-12"')
assert.equal(csvLine([csvCell('=a'), csvCell(3, 'number')]), `"'=a","3"\r\n`)

assert.equal(
  activityWording('credits.transfer', { amount: 1000, debtRecovered: 200 }, 'Acme'),
  'Sent 1,000 credits to Acme (200 repaid owed credits)'
)
assert.equal(activityWording('org.rename', { from: 'Acme', to: 'Acme Studio' }), 'Renamed Acme to Acme Studio')
assert.equal(activityWording('plan.change', { fromPlan: 'Pro', toPlan: 'Max' }), 'Changed plan from Pro to Max')
assert.equal(activityWording('plan.activated', { plan: 'Max' }), 'Max plan started')
assert.equal(actorLabel('system'), 'Automatic')

assert.equal(releaseReasonWording('cancelled'), 'Cancelled')
assert.equal(releaseReasonWording('fal_not_accepted'), 'Not accepted')
assert.equal(releaseReasonWording('plan_inactive'), 'Plan inactive')
assert.equal(releaseReasonWording('some_new_reason'), 'Some new reason')
assert.equal(releaseReasonWording(null), null)

console.log('analytics.selfcheck: ok')
