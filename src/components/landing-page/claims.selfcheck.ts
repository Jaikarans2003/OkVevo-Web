import assert from 'node:assert/strict'
import { ASK_BOTH, COMPARISON, HANDLES, assertLandingClaims, niaCell } from './claims.ts'
import { earlyAccessError } from './early-access.ts'

assertLandingClaims()
assert.equal(niaCell(COMPARISON.find((row) => row.label === 'Bank reconciliation')!).soon, true)
assert.equal(ASK_BOTH.length, 3)
assert.equal(HANDLES[0], 'Bank reconciliation')
assert.equal(earlyAccessError({ email: '' }), 'Email is required.')
assert.equal(earlyAccessError({ email: 'not-an-email' }), 'Enter a valid email.')
assert.equal(earlyAccessError({ email: 'a@firm.co' }), null)
console.log('landing claims ok')
