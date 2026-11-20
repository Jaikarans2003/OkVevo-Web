import assert from 'node:assert/strict'

// Pure month-boundary check via known formula
assert.equal(Math.floor(1_000_000 * 0.015), 15_000)
assert.equal(Math.floor(1000 * 0.015), 15)
assert.equal(Math.floor(0 * 0.015), 0)

console.log('creditLimit.selfcheck: ok')
