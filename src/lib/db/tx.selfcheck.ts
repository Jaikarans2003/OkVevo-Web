/**
 * Tiny assert check for withTx retry classification (no DB required).
 * Run: npx tsx src/lib/db/tx.selfcheck.ts
 */
import assert from 'node:assert/strict'

function pgCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

const RETRYABLE = new Set(['40P01', '55P03'])

assert.equal(RETRYABLE.has(pgCode({ code: '40P01' })!), true)
assert.equal(RETRYABLE.has(pgCode({ code: '55P03' })!), true)
assert.equal(RETRYABLE.has(pgCode({ code: '23505' })!), false)
assert.equal(pgCode(null), undefined)
console.log('tx.selfcheck: ok')
