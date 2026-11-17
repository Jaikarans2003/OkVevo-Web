/**
 * Run: npx tsx src/lib/billing/ledgerInvariant.selfcheck.ts
 */
import assert from 'node:assert/strict'

import { ledgerBucketDelta } from '@/lib/billing/ledgerInvariant'

assert.equal(ledgerBucketDelta(100, 100, 0), 0)
assert.equal(ledgerBucketDelta(70, 100, 30), 0) // open hold already carved from cache
assert.equal(ledgerBucketDelta(99, 100, 0), -1)
assert.equal(ledgerBucketDelta(0, 0, 0), 0)
console.log('ledgerInvariant.selfcheck: ok')
