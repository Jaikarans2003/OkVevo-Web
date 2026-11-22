/**
 * Department labels per org (not used by authorizeOrg).
 */
import type { TxSql } from '@/lib/db/tx'
import { writeAuditLog } from '@/lib/orgs/auditLog'

export type DeptFail = 'invalid_name' | 'not_found' | 'duplicate'

export type DeptResult =
  | { ok: true; id: string }
  | { ok: false; code: DeptFail }

export async function createDepartment(
  tx: TxSql,
  opts: { orgId: string; name: string; actorUserId: string }
): Promise<DeptResult> {
  const name = opts.name.trim()
  if (!name) return { ok: false, code: 'invalid_name' }
  try {
    const rows = await tx`
      insert into departments (org_id, name)
      values (${opts.orgId}, ${name})
      returning id
    `
    const id = String(rows[0]!.id)
    await writeAuditLog(tx, {
      orgId: opts.orgId,
      actorUserId: opts.actorUserId,
      action: 'department.create',
      targetType: 'department',
      targetId: id,
      metadata: { name },
    })
    return { ok: true, id }
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
      return { ok: false, code: 'duplicate' }
    }
    throw e
  }
}

export async function renameDepartment(
  tx: TxSql,
  opts: { orgId: string; departmentId: string; name: string; actorUserId: string }
): Promise<DeptResult> {
  const name = opts.name.trim()
  if (!name) return { ok: false, code: 'invalid_name' }
  try {
    const rows = await tx`
      update departments set name = ${name}
      where id = ${opts.departmentId} and org_id = ${opts.orgId}
      returning id
    `
    if (!rows[0]) return { ok: false, code: 'not_found' }
    await writeAuditLog(tx, {
      orgId: opts.orgId,
      actorUserId: opts.actorUserId,
      action: 'department.rename',
      targetType: 'department',
      targetId: opts.departmentId,
      metadata: { name },
    })
    return { ok: true, id: opts.departmentId }
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
      return { ok: false, code: 'duplicate' }
    }
    throw e
  }
}

export async function deleteDepartment(
  tx: TxSql,
  opts: { orgId: string; departmentId: string; actorUserId: string }
): Promise<'ok' | 'not_found'> {
  const rows = await tx`
    delete from departments
    where id = ${opts.departmentId} and org_id = ${opts.orgId}
    returning id
  `
  if (!rows[0]) return 'not_found'
  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.actorUserId,
    action: 'department.delete',
    targetType: 'department',
    targetId: opts.departmentId,
  })
  return 'ok'
}

export async function assignMemberDepartment(
  tx: TxSql,
  opts: {
    orgId: string
    userId: string
    departmentId: string | null
    actorUserId: string
  }
): Promise<'ok' | 'not_found' | 'bad_department'> {
  if (opts.departmentId) {
    const dept = await tx`
      select id from departments where id = ${opts.departmentId} and org_id = ${opts.orgId}
    `
    if (!dept[0]) return 'bad_department'
  }
  const rows = await tx`
    update memberships
    set department_id = ${opts.departmentId}
    where org_id = ${opts.orgId} and user_id = ${opts.userId} and status = 'active'
    returning user_id
  `
  if (!rows[0]) return 'not_found'
  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.actorUserId,
    action: 'member.department',
    targetType: 'user',
    targetId: opts.userId,
    metadata: { departmentId: opts.departmentId },
  })
  return 'ok'
}