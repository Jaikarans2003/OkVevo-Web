/** Opaque join codes (plaintext stored; prefix is display + early validation only). */
import { randomBytes } from 'node:crypto'

const CODE_BYTES = 16 // 128 bits ≥ 80-bit floor

/** Prefixed join code: `okv_org_` / `okv_sorg_` + url-safe entropy. */
export function mintJoinCode(kind: 'org' | 'super_org'): string {
  const prefix = kind === 'super_org' ? 'okv_sorg_' : 'okv_org_'
  return prefix + randomBytes(CODE_BYTES).toString('base64url')
}
