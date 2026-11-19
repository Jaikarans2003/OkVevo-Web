/**
 * Email invitations: create (token once) / accept (verified email match).
 */
import type { TxSql } from '@/lib/db/tx'
import { mintInviteToken, sha256Hex } from '@/lib/orgs/tokens'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function createInvitation(
  tx: TxSql,
  opts: {
    orgId: string
    email: string
    role: 'owner' | 'admin' | 'member'
    invitedBy: string
    expiresAt?: Date
  }
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const email = opts.email.trim().toLowerCase()
  if (!email || !email.includes('@')) throw new Error('invalid_email')
  const token = mintInviteToken()
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS)
  const rows = await tx`
    insert into invitations (org_id, email, role, token_hash, expires_at, invited_by)
    values (
      ${opts.orgId},
      ${email},
      ${opts.role},
      ${sha256Hex(token)},
      ${expiresAt},
      ${opts.invitedBy}
    )
    returning id
  `
  return { id: String(rows[0]!.id), token, expiresAt }
}

export type AcceptFail =
  | 'invalid_token'
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'email_mismatch'
  | 'email_unverified'

export type AcceptResult =
  | { ok: true; orgId: string; role: string }
  | { ok: false; code: AcceptFail }

export async function acceptInvitation(
  tx: TxSql,
  opts: {
    token: string
    userId: string
    email: string | null | undefined
    emailVerified: boolean
    now?: Date
  }
): Promise<AcceptResult> {
  if (!opts.emailVerified) return { ok: false, code: 'email_unverified' }
  const email = (opts.email ?? '').trim().toLowerCase()
  if (!email) return { ok: false, code: 'email_mismatch' }

  const now = opts.now ?? new Date()
  const rows = await tx`
    select id, org_id, email, role, expires_at, accepted_at, revoked_at
    from invitations
    where token_hash = ${sha256Hex(opts.token.trim())}
    for update
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return { ok: false, code: 'invalid_token' }
  if (row.revoked_at) return { ok: false, code: 'revoked' }
  if (row.accepted_at) return { ok: false, code: 'already_accepted' }
  const expiresAt =
    row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at))
  if (expiresAt.getTime() <= now.getTime()) return { ok: false, code: 'expired' }
  if (String(row.email).toLowerCase() !== email) return { ok: false, code: 'email_mismatch' }

  const orgId = String(row.org_id)
  const role = String(row.role)

  const existing = await tx`
    select status from memberships
    where org_id = ${orgId} and user_id = ${opts.userId}
    for update
  `
  if (existing[0]?.status === 'active') {
    // Already a member — mark invite accepted, no role change.
  } else if (existing[0]) {
    await tx`
      update memberships
      set role = ${role}, status = 'active', created_at = now()
      where org_id = ${orgId} and user_id = ${opts.userId}
    `
  } else {
    await tx`
      insert into memberships (org_id, user_id, role, status)
      values (${orgId}, ${opts.userId}, ${role}, 'active')
    `
  }

  await tx`
    update invitations
    set accepted_at = ${now}, accepted_by = ${opts.userId}
    where id = ${String(row.id)}
  `

  return { ok: true, orgId, role }
}
