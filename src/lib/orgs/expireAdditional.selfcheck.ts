/**
 * Pure expiry amount. Run: npx tsx src/lib/orgs/expireAdditional.selfcheck.ts
 */
import assert from 'node:assert/strict'

import { additionalExpiringAmount } from './expireAdditional.ts'

// Jan 1000 + Jun 1000, spent 500 → balance 1500; next Jan unexpired=1000 → expire 500
assert.equal(additionalExpiringAmount(1500, 1000), 500)

// Spent 1200 → balance 800; unexpired=1000 → expire 0
assert.equal(additionalExpiringAmount(800, 1000), 0)

// Negative wallet → 0
assert.equal(additionalExpiringAmount(-300, 0), 0)

// Fully unexpired → 0
assert.equal(additionalExpiringAmount(1000, 1000), 0)

console.log('expireAdditional.selfcheck: ok')
