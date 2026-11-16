/**
 * Trusted client IP is rightmost X-Forwarded-For (GFE), not leftmost.
 * Run: npx tsx src/lib/api/clientIp.selfcheck.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { clientIpFromRequest } from './clientIp.ts'

function headers(map: Record<string, string>) {
  return {
    get(name: string) {
      return map[name.toLowerCase()] ?? null
    },
  }
}

/** Same shape as api-utils checkRateLimit — kept local so this file never loads firebase-admin. */
function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  limitPerMinute: number
): boolean {
  const now = Date.now()
  let cur = store.get(key)
  if (!cur || cur.resetAt < now) cur = { count: 1, resetAt: now + 60_000 }
  else cur.count++
  store.set(key, cur)
  return cur.count <= limitPerMinute
}

assert.equal(clientIpFromRequest(headers({})), 'unknown')
assert.equal(clientIpFromRequest(headers({ 'x-real-ip': '203.0.113.9' })), '203.0.113.9')
assert.equal(
  clientIpFromRequest(headers({ 'x-forwarded-for': '198.51.100.1' })),
  '198.51.100.1'
)
assert.equal(
  clientIpFromRequest(
    headers({ 'x-forwarded-for': '198.51.100.1, 203.0.113.7, 35.191.0.1' })
  ),
  '35.191.0.1',
  'rightmost is GFE-appended peer'
)
assert.equal(
  clientIpFromRequest(
    headers({ 'x-forwarded-for': 'spoof, 203.0.113.7, 35.191.0.1' }),
    { proxyHops: 1 }
  ),
  '203.0.113.7',
  'one trusted hop left of rightmost'
)

// Spoofed left entries cannot open a new rate-limit bucket when the rightmost
// (GFE) IP is unchanged.
const real = '35.191.0.1'
const keyA = `contact:${clientIpFromRequest(headers({ 'x-forwarded-for': `1.1.1.1, ${real}` }))}`
const keyB = `contact:${clientIpFromRequest(headers({ 'x-forwarded-for': `9.9.9.9, ${real}` }))}`
assert.equal(keyA, keyB)

const store = new Map<string, { count: number; resetAt: number }>()
const limit = 3
for (let i = 0; i < limit; i++) {
  assert.equal(checkRateLimit(store, keyA, limit), true)
}
assert.equal(
  checkRateLimit(store, keyB, limit),
  false,
  'spoofed XFF must not bypass the limit'
)

const route = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../app/api/contact/route.ts'),
  'utf8'
)
assert.match(route, /clientIpFromRequest/)
assert.doesNotMatch(route, /split\(','\)\[0\]/)

console.log('clientIp.selfcheck: ok')
