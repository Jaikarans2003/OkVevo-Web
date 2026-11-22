/**
 * Layer 1: usage period window.
 * Run: npx tsx src/lib/orgs/periodWindow.selfcheck.ts
 */
import assert from 'node:assert/strict'

import { usagePeriodWindow } from './periodWindow.ts'

const now = new Date('2026-03-15T12:00:00.000Z')

const prepaid = usagePeriodWindow({
  accessMode: 'prepaid',
  billingCycle: null,
  currentPeriodEnd: null,
  now,
})
assert.equal(prepaid.from.toISOString(), '2026-03-01T00:00:00.000Z')
assert.equal(prepaid.to.toISOString(), '2026-04-01T00:00:00.000Z')

const periodEnd = new Date('2026-03-20T00:00:00.000Z')
const monthly = usagePeriodWindow({
  accessMode: 'subscription',
  billingCycle: 'monthly',
  currentPeriodEnd: periodEnd,
  now,
})
assert.equal(monthly.from.toISOString(), '2026-02-20T00:00:00.000Z')
assert.equal(monthly.to.toISOString(), now.toISOString())

const annualEnd = new Date('2026-12-01T00:00:00.000Z')
const annual = usagePeriodWindow({
  accessMode: 'subscription',
  billingCycle: 'annual',
  currentPeriodEnd: annualEnd,
  now: new Date('2026-06-01T00:00:00.000Z'),
})
assert.equal(annual.from.toISOString(), '2025-12-01T00:00:00.000Z')

console.log('periodWindow.selfcheck: ok')
