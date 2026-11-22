/**
 * Member role changes + soft-remove. Last owner cannot be removed/demoted.
 */
import type { TxSql } from '@/lib/db/tx'
import type { OrgRole } from '@/lib/orgs/authorize'
import { writeAuditLog } from '@/lib/orgs/auditLog'

export type MemberFail =
  | 'not_found'
  | 'last_owner'
  | 'invalid_role'

export type MemberResult = { ok: true } | { ok: false; code: MemberFail }

async function activeOwnerCount(tx: TxSql, orgId: string): Promise<number> {
  const rows = await tx`
    select count(*)::int as c from memberships
    where org_id = ${orgId} and status = 'active' and role = 'owner'
  `
  return Number(rows[0]?.c ?? 0)
}

export async function setMemberRole(
  tx: TxSql,
  opts: { orgId: string; userId: string; role: OrgRole; actorUserId?: string }
): Promise<MemberResult> {
  if (!['owner', 'admin', 'member'].includes(opts.role)) {
    return { ok: false, code: 'invalid_role' }
  }
  const rows = await tx`
    select role, status from memberships
    where org_id = ${opts.orgId} and user_id = ${opts.userId}
    for update
  `
  const row = rows[0] as { role: string; status: string } | undefined
  if (!row || row.status !== 'active') return { ok: false, code: 'not_found' }

  if (row.role === 'owner' && opts.role !== 'owner') {
    if ((await activeOwnerCount(tx, opts.orgId)) <= 1) {
      return { ok: false, code: 'last_owner' }
    }
  }

  await tx`
    update memberships set role = ${opts.role}
    where org_id = ${opts.orgId} and user_id = ${opts.userId}
  `
  if (opts.actorUserId) {
    await writeAuditLog(tx, {
      orgId: opts.orgId,
      actorUserId: opts.actorUserId,
      action: 'member.role',
      targetType: 'user',
      targetId: opts.userId,
      metadata: { role: opts.role, previousRole: row.role },
    })
  }
  return { ok: true }
}

export async function removeMember(
  tx: TxSql,
  opts: { orgId: string; userId: string; actorUserId?: string }
): Promise<MemberResult> {
  const rows = await tx`
    select role, status from memberships
    where org_id = ${opts.orgId} and user_id = ${opts.userId}
    for update
  `
  const row = rows[0] as { role: string; status: string } | undefined
  if (!row || row.status !== 'active') return { ok: false, code: 'not_found' }

  if (row.role === 'owner' && (await activeOwnerCount(tx, opts.orgId)) <= 1) {
    return { ok: false, code: 'last_owner' }
  }

  await tx`
    update memberships set status = 'removed'
    where org_id = ${opts.orgId} and user_id = ${opts.userId}
  `
  if (opts.actorUserId) {
    await writeAuditLog(tx, {
      orgId: opts.orgId,
      actorUserId: opts.actorUserId,
      action: 'member.remove',
      targetType: 'user',
      targetId: opts.userId,
      metadata: { role: row.role },
    })
  }
  return { ok: true }
}
