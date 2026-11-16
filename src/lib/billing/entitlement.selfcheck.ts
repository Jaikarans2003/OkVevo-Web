/**
 * Run: npx tsx src/lib/billing/entitlement.selfcheck.ts
 */
import assert from 'node:assert/strict'

import { isEntitled } from '@/lib/billing/entitlement'

const now = new Date('2026-06-15T12:00:00.000Z')
const future = new Date('2026-07-01T00:00:00.000Z')
const past = new Date('2026-06-01T00:00:00.000Z')

assert.equal(isEntitled({ planStatus: 'active', currentPeriodEnd: future }, now), true)
assert.equal(isEntitled({ planStatus: 'active', currentPeriodEnd: past }, now), false)
assert.equal(isEntitled({ planStatus: 'active', currentPeriodEnd: null }, now), false)
assert.equal(isEntitled({ planStatus: 'active', currentPeriodEnd: undefined }, now), false)
assert.equal(isEntitled({ planStatus: 'cancelled', currentPeriodEnd: future }, now), false)
assert.equal(isEntitled(null, now), false)
console.log('entitlement.selfcheck: ok')
