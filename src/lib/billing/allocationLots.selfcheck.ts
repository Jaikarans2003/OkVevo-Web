/**
 * Allocation lot FIFO + per-subscription remaining.
 * Run: npx tsx src/lib/billing/allocationLots.selfcheck.ts
 */
import assert from 'node:assert/strict'

import {
  remainingByLot,
  remainingForSubscription,
  takeFromLots,
  type AllocationLot,
} from './allocationLots.ts'

const oldExp = new Date('2026-06-01T00:00:00.000Z')
const newExp = new Date('2026-12-01T00:00:00.000Z')
const lots: AllocationLot[] = [
  {
    subscriptionId: 'sub_annual',
    amount: 1000,
    expiresAt: oldExp,
    createdAt: new Date('2025-06-01'),
  },
  {
    subscriptionId: 'sub_monthly',
    amount: 2000,
    expiresAt: newExp,
    createdAt: new Date('2026-05-01'),
  },
]

// Full balance → both lots intact
const full = remainingByLot(lots, 3000)
assert.equal(full.length, 2)
assert.equal(full[0]!.subscriptionId, 'sub_annual')
assert.equal(full[0]!.amount, 1000)
assert.equal(full[1]!.amount, 2000)

// Spent 500 from oldest → annual 500 left
const afterSpend = remainingByLot(lots, 2500)
assert.equal(afterSpend[0]!.amount, 500)
assert.equal(remainingForSubscription(lots, 2500, 'sub_annual'), 500)
assert.equal(remainingForSubscription(lots, 2500, 'sub_monthly'), 2000)

// Draw 800 → takes all 500 annual + 300 monthly
const take = takeFromLots(afterSpend, 800)
assert.equal(take.length, 2)
assert.equal(take[0]!.subscriptionId, 'sub_annual')
assert.equal(take[0]!.amount, 500)
assert.equal(take[1]!.subscriptionId, 'sub_monthly')
assert.equal(take[1]!.amount, 300)

assert.deepEqual(takeFromLots(afterSpend, 99999), [])

console.log('allocationLots.selfcheck: ok')
