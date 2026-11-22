/**
 * Email invitations: create (token once) / accept (verified email match).
 */
import type { DbHandle } from '@/lib/db/wallet'
import type { TxSql } from '@/lib/db/tx'
import { writeAuditLog } from '@/lib/orgs/auditLog'
import { mintInviteToken, sha256Hex } from '@/lib/orgs/tokens'

export const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function createInvitation(
  tx: TxSql,
  opts: {
    orgId: string
    email: string
    role: 'owner' | 'admin' | 'member'
    invitedBy: string
    expiresAt?: Date
    departmentId?: string | null
  }
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const email = opts.email.trim().toLowerCase()
  if (!email || !email.includes('@')) throw new Error('invalid_email')
  const token = mintInviteToken()
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + INVITE_TTL_MS)
  const rows = await tx`
    insert into invitations (
      org_id, email, role, token_hash, expires_at, invited_by, department_id
    )
    values (
      ${opts.orgId},
      ${email},
      ${opts.role},
      ${sha256Hex(token)},
      ${expiresAt},
      ${opts.invitedBy},
      ${opts.departmentId ?? null}
    )
    returning id
  `
  const id = String(rows[0]!.id)
  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.invitedBy,
    action: 'invitation.create',
    targetType: 'invitation',
    targetId: id,
    metadata: { email, role: opts.role, departmentId: opts.departmentId ?? null },
  })
  return { id, token, expiresAt }
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

async function applyInviteMembership(
  tx: TxSql,
  opts: { orgId: string; userId: string; role: string; departmentId: string | null }
): Promise<void> {
  const existing = await tx`
    select status from memberships
    where org_id = ${opts.orgId} and user_id = ${opts.userId}
    for update
  `
  if (existing[0]?.status === 'active') {
    return
  }
  if (existing[0]) {
    await tx`
      update memberships
      set role = ${opts.role},
          status = 'active',
          department_id = coalesce(${opts.departmentId}, department_id),
          created_at = now()
      where org_id = ${opts.orgId} and user_id = ${opts.userId}
    `
  } else {
    await tx`
      insert into memberships (org_id, user_id, role, status, department_id)
      values (${opts.orgId}, ${opts.userId}, ${opts.role}, 'active', ${opts.departmentId})
    `
  }
}

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
    select id, org_id, email, role, department_id, expires_at, accepted_at, revoked_at
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
  const departmentId = row.department_id ? String(row.department_id) : null

  await applyInviteMembership(tx, { orgId, userId: opts.userId, role, departmentId })

  await tx`
    update invitations
    set accepted_at = ${now}, accepted_by = ${opts.userId}
    where id = ${String(row.id)}
  `

  await writeAuditLog(tx, {
    orgId,
    actorUserId: opts.userId,
    action: 'invitation.accept',
    targetType: 'invitation',
    targetId: String(row.id),
    metadata: { email, role },
  })

  return { ok: true, orgId, role }
}

export async function declineInvitation(
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
    select id, org_id, email, expires_at, accepted_at, revoked_at
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
  await tx`update invitations set revoked_at = ${now} where id = ${String(row.id)}`
  await writeAuditLog(tx, {
    orgId,
    actorUserId: opts.userId,
    action: 'invitation.decline',
    targetType: 'invitation',
    targetId: String(row.id),
    metadata: { email },
  })
  return { ok: true, orgId, role: '' }
}

export async function revokeInvitation(
  tx: TxSql,
  opts: { orgId: string; invitationId: string; actorUserId: string; now?: Date }
): Promise<'ok' | 'not_found' | 'not_pending'> {
  const now = opts.now ?? new Date()
  const rows = await tx`
    select id, accepted_at, revoked_at
    from invitations
    where id = ${opts.invitationId} and org_id = ${opts.orgId}
    for update
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return 'not_found'
  if (row.accepted_at || row.revoked_at) return 'not_pending'
  await tx`update invitations set revoked_at = ${now} where id = ${opts.invitationId}`
  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.actorUserId,
    action: 'invitation.revoke',
    targetType: 'invitation',
    targetId: opts.invitationId,
  })
  return 'ok'
}

export async function resendInvitation(
  tx: TxSql,
  opts: { orgId: string; invitationId: string; actorUserId: string }
): Promise<{ ok: true; token: string; expiresAt: Date; id: string } | { ok: false; code: 'not_found' | 'not_pending' }> {
  const rows = await tx`
    select id, email, role, department_id, accepted_at, revoked_at
    from invitations
    where id = ${opts.invitationId} and org_id = ${opts.orgId}
    for update
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return { ok: false, code: 'not_found' }
  if (row.accepted_at || row.revoked_at) return { ok: false, code: 'not_pending' }

  const now = new Date()
  await tx`update invitations set revoked_at = ${now} where id = ${opts.invitationId}`

  const created = await createInvitation(tx, {
    orgId: opts.orgId,
    email: String(row.email),
    role: row.role as 'owner' | 'admin' | 'member',
    invitedBy: opts.actorUserId,
    departmentId: row.department_id ? String(row.department_id) : null,
  })

  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.actorUserId,
    action: 'invitation.resend',
    targetType: 'invitation',
    targetId: created.id,
    metadata: { replacedInvitationId: opts.invitationId },
  })

  return { ok: true, token: created.token, expiresAt: created.expiresAt, id: created.id }
}

export type PendingInvite = {
  id: string
  token: string
  orgPublicId: string
  orgName: string
  role: string
  expiresAt: string
  inviteUrl?: string
}

/** Pending email invitations for a verified address (token returned for Accept/Decline APIs). */
export async function listPendingInvitesForEmail(
  db: DbHandle,
  opts: { email: string; now?: Date }
): Promise<PendingInvite[]> {
  const email = opts.email.trim().toLowerCase()
  if (!email) return []
  const now = opts.now ?? new Date()
  const rows = await db`
    select i.id, i.token_hash, i.role, i.expires_at, o.public_id, o.name
    from invitations i
    join organizations o on o.id = i.org_id
    where lower(i.email) = ${email}
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > ${now}
    order by i.created_at asc
  `
  // token_hash only — callers that need the raw token use /invite/:token page or resend output.
  // For /api/me we attach a server-only lookup: store token in a separate query is impossible.
  // ponytail: expose invitation id; Accept/Decline use invitation id via me.pendingInvites.
  return rows.map((row) => ({
    id: String(row.id),
    token: '',
    orgPublicId: String(row.public_id),
    orgName: String(row.name),
    role: String(row.role),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
  }))
}

export async function listPendingInvitesWithTokensForEmail(
  db: DbHandle,
  opts: { email: string; now?: Date }
): Promise<Array<PendingInvite & { invitationId: string }>> {
  const email = opts.email.trim().toLowerCase()
  if (!email) return []
  const now = opts.now ?? new Date()
  const rows = await db`
    select i.id, i.role, i.expires_at, o.public_id, o.name
    from invitations i
    join organizations o on o.id = i.org_id
    where lower(i.email) = ${email}
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > ${now}
    order by i.created_at asc
  `
  return rows.map((row) => ({
    invitationId: String(row.id),
    id: String(row.id),
    token: '',
    orgPublicId: String(row.public_id),
    orgName: String(row.name),
    role: String(row.role),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
  }))
}

export async function listOrgPendingInvitations(
  db: DbHandle,
  orgId: string
): Promise<
  Array<{
    id: string
    email: string
    role: string
    expiresAt: string
    departmentId: string | null
    createdAt: string
  }>
> {
  const now = new Date()
  const rows = await db`
    select id, email, role, department_id, expires_at, created_at
    from invitations
    where org_id = ${orgId}
      and accepted_at is null
      and revoked_at is null
      and expires_at > ${now}
    order by created_at desc
  `
  return rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: String(row.role),
    departmentId: row.department_id ? String(row.department_id) : null,
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }))
}

export async function getInvitationByIdForAccept(
  tx: TxSql,
  opts: { invitationId: string; userId: string; email: string; emailVerified: boolean; now?: Date }
): Promise<AcceptResult> {
  if (!opts.emailVerified) return { ok: false, code: 'email_unverified' }
  const email = opts.email.trim().toLowerCase()
  const now = opts.now ?? new Date()
  const rows = await tx`
    select id, org_id, email, role, department_id, expires_at, accepted_at, revoked_at
    from invitations
    where id = ${opts.invitationId}
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
  const departmentId = row.department_id ? String(row.department_id) : null
  await applyInviteMembership(tx, { orgId, userId: opts.userId, role, departmentId })
  await tx`
    update invitations set accepted_at = ${now}, accepted_by = ${opts.userId}
    where id = ${opts.invitationId}
  `
  await writeAuditLog(tx, {
    orgId,
    actorUserId: opts.userId,
    action: 'invitation.accept',
    targetType: 'invitation',
    targetId: opts.invitationId,
    metadata: { email, role },
  })
  return { ok: true, orgId, role }
}

export async function declineInvitationById(
  tx: TxSql,
  opts: { invitationId: string; userId: string; email: string; emailVerified: boolean; now?: Date }
): Promise<AcceptResult> {
  if (!opts.emailVerified) return { ok: false, code: 'email_unverified' }
  const email = opts.email.trim().toLowerCase()
  const now = opts.now ?? new Date()
  const rows = await tx`
    select id, org_id, email, expires_at, accepted_at, revoked_at
    from invitations
    where id = ${opts.invitationId}
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
  await tx`update invitations set revoked_at = ${now} where id = ${opts.invitationId}`
  await writeAuditLog(tx, {
    orgId,
    actorUserId: opts.userId,
    action: 'invitation.decline',
    targetType: 'invitation',
    targetId: opts.invitationId,
    metadata: { email },
  })
  return { ok: true, orgId, role: '' }
}