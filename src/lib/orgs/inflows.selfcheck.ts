/**
 * Oldest-expiry remaining + take. Run: npx tsx src/lib/orgs/inflows.selfcheck.ts
 */
import assert from 'node:assert/strict'

import { remainingByInflow, takeFromRemaining } from './inflows.ts'

const jan = new Date('2026-01-15T00:00:00.000Z')
const jun = new Date('2026-06-15T00:00:00.000Z')
const expJan = new Date('2027-01-15T00:00:00.000Z')
const expJun = new Date('2027-06-15T00:00:00.000Z')

const inflows = [
  { id: 'g-jan', amount: 1000, expiresAt: expJan, createdAt: jan },
  { id: 'g-jun', amount: 1000, expiresAt: expJun, createdAt: jun },
]

// Spent 500 → leftover is all of Jun + 500 of Jan
const rem500 = remainingByInflow(inflows, 1500)
assert.deepEqual(
  rem500.map((r) => ({ id: r.inflowId, amount: r.amount })),
  [
    { id: 'g-jan', amount: 500 },
    { id: 'g-jun', amount: 1000 },
  ]
)

// Spent 1200 → only 800 of Jun left
const rem1200 = remainingByInflow(inflows, 800)
assert.deepEqual(
  rem1200.map((r) => ({ id: r.inflowId, amount: r.amount })),
  [{ id: 'g-jun', amount: 800 }]
)

const take = takeFromRemaining(rem500, 700)
assert.deepEqual(
  take.map((r) => ({ id: r.inflowId, amount: r.amount })),
  [
    { id: 'g-jan', amount: 500 },
    { id: 'g-jun', amount: 200 },
  ]
)

assert.deepEqual(takeFromRemaining(rem500, 2000), [])

console.log('inflows.selfcheck: ok')
