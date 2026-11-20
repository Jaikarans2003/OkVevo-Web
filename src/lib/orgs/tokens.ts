/** Opaque codes / invite tokens → sha256 hex for storage. */
import { createHash, randomBytes } from 'node:crypto'

export function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

/** 20-byte url-safe code shown once (join). */
export function mintJoinCode(): string {
  return randomBytes(20).toString('base64url')
}

/** 32-byte invite token shown once in the link. */
export function mintInviteToken(): string {
  return randomBytes(32).toString('base64url')
}
