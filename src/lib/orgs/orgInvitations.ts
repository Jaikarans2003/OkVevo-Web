/**
 * Super-org invites an existing organisation to become a prepaid child.
 */
import type { TxSql } from '@/lib/db/tx'
import { writeAuditLog } from '@/lib/orgs/auditLog'

export type OrgInviteFail =
  | 'invalid_target'
  | 'org_not_found'
  | 'not_org'
  | 'super_org_target'
  | 'already_parented'
  | 'pending_exists'
  | 'owner_not_found'

export type OrgInviteResult =
  | { ok: true; id: string }
  | { ok: false; code: OrgInviteFail }

export async function createOrgInvitation(
  tx: TxSql,
  opts: {
    superOrgId: string
    targetOrgId: string
    invitedBy: string
  }
): Promise<OrgInviteResult> {
  const targetRows = await tx`
    select id, kind, parent_id from organizations where id = ${opts.targetOrgId} for update
  `
  const target = targetRows[0] as Record<string, unknown> | undefined
  if (!target) return { ok: false, code: 'org_not_found' }
  if (target.kind !== 'org') return { ok: false, code: target.kind === 'super_org' ? 'super_org_target' : 'not_org' }
  if (target.parent_id) return { ok: false, code: 'already_parented' }

  const superRows = await tx`
    select id, kind from organizations where id = ${opts.superOrgId} for update
  `
  if (!superRows[0] || superRows[0]!.kind !== 'super_org') {
    return { ok: false, code: 'invalid_target' }
  }

  const pending = await tx`
    select id from org_invitations
    where org_id = ${opts.targetOrgId} and status = 'pending'
    for update
  `
  if (pending[0]) return { ok: false, code: 'pending_exists' }

  const rows = await tx`
    insert into org_invitations (super_org_id, org_id, invited_by, status)
    values (${opts.superOrgId}, ${opts.targetOrgId}, ${opts.invitedBy}, 'pending')
    returning id
  `
  const id = String(rows[0]!.id)
  await writeAuditLog(tx, {
    orgId: opts.superOrgId,
    actorUserId: opts.invitedBy,
    action: 'org_invitation.create',
    targetType: 'organization',
    targetId: opts.targetOrgId,
    metadata: { invitationId: id },
  })
  return { ok: true, id }
}

export async function resolveOrgIdByOwnerEmail(
  tx: TxSql,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const rows = await tx`
    select o.id
    from organizations o
    join memberships m on m.org_id = o.id and m.status = 'active' and m.role = 'owner'
    join users u on u.id = m.user_id
    where lower(coalesce(u.email, '')) = ${normalized}
    order by o.created_at asc
    limit 1
  `
  return rows[0]?.id ? String(rows[0].id) : null
}

export async function findPendingOrgInvitation(
  tx: TxSql,
  opts: { childOrgId: string; superOrgId: string }
): Promise<{ id: string } | null> {
  const rows = await tx`
    select id from org_invitations
    where org_id = ${opts.childOrgId}
      and super_org_id = ${opts.superOrgId}
      and status = 'pending'
    for update
  `
  return rows[0] ? { id: String(rows[0].id) } : null
}

export async function markOrgInvitationAccepted(
  tx: TxSql,
  opts: { invitationId: string; now?: Date }
): Promise<void> {
  const now = opts.now ?? new Date()
  await tx`
    update org_invitations
    set status = 'accepted', responded_at = ${now}
    where id = ${opts.invitationId}
  `
}

export async function declineOrgInvitation(
  tx: TxSql,
  opts: { childOrgId: string; superOrgId: string; actorUserId: string; now?: Date }
): Promise<'ok' | 'not_found'> {
  const now = opts.now ?? new Date()
  const rows = await tx`
    update org_invitations
    set status = 'declined', responded_at = ${now}
    where org_id = ${opts.childOrgId}
      and super_org_id = ${opts.superOrgId}
      and status = 'pending'
    returning id
  `
  if (!rows[0]) return 'not_found'
  await writeAuditLog(tx, {
    orgId: opts.childOrgId,
    actorUserId: opts.actorUserId,
    action: 'org_invitation.decline',
    targetType: 'organization',
    targetId: opts.superOrgId,
    metadata: { invitationId: String(rows[0]!.id) },
  })
  return 'ok'
}

export async function revokeOrgInvitation(
  tx: TxSql,
  opts: { invitationId: string; superOrgId: string; actorUserId: string; now?: Date }
): Promise<'ok' | 'not_found'> {
  const now = opts.now ?? new Date()
  const rows = await tx`
    update org_invitations
    set status = 'revoked', responded_at = ${now}
    where id = ${opts.invitationId} and super_org_id = ${opts.superOrgId} and status = 'pending'
    returning org_id
  `
  if (!rows[0]) return 'not_found'
  await writeAuditLog(tx, {
    orgId: opts.superOrgId,
    actorUserId: opts.actorUserId,
    action: 'org_invitation.revoke',
    targetType: 'organization',
    targetId: String(rows[0]!.org_id),
    metadata: { invitationId: opts.invitationId },
  })
  return 'ok'
}