/**
 * Stripe-style unguessable public ids: org_ / sorg_ + 20 base32 chars.
 */
import { randomBytes } from 'node:crypto'

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567'

export function randomPublicId(kind: 'org' | 'super_org'): string {
  const prefix = kind === 'super_org' ? 'sorg_' : 'org_'
  const bytes = randomBytes(20)
  let out = ''
  for (let i = 0; i < 20; i++) {
    out += BASE32[bytes[i]! % 32]
  }
  return prefix + out
}
