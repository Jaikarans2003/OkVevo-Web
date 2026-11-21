import assert from 'node:assert/strict'

import { overdrawnCredits, overdrawnPct, overdrawnSentence } from './overdrawn.ts'

assert.equal(overdrawnPct(100, 50), 0)
assert.equal(overdrawnPct(-50, 100), 50)
assert.equal(overdrawnPct(-50, 0), 100)
assert.equal(overdrawnPct(-200, 100), 100)
assert.equal(overdrawnCredits(-40), 40)
assert.equal(overdrawnCredits(10), 0)
assert.equal(
  overdrawnSentence(50, 'Acme Super'),
  'Overdrawn: 50% of your 1.5% limit used. Ask Acme Super for credits.'
)

console.log('overdrawn.selfcheck: ok')
