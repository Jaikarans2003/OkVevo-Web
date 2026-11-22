/**
 * Join codes: one plaintext member/parent code per org (+ super-org).
 * Lookup by `code` only. Redeem orchestration (kind routing) lives in the join route.
 */
import type { DbHandle } from '@/lib/db/wallet'
import type { TxSql } from '@/lib/db/tx'
import { writeAuditLog } from '@/lib/orgs/auditLog'
import { mintJoinCode } from '@/lib/orgs/tokens'

const JOIN_RATE_WINDOW_MS = 60 * 60 * 1000
const JOIN_RATE_MAX = 30

export type JoinCodeRow = {
  id: string
  orgId: string
  code: string
  revokedAt: Date | null
  createdAt: Date
}

export type JoinCodeOrg = {
  joinCodeId: string
  orgId: string
  publicId: string
  kind: 'org' | 'super_org'
  parentId: string | null
  name: string
  revokedAt: Date | null
}

export async function createJoinCode(
  tx: TxSql,
  opts: {
    orgId: string
    createdBy: string
    kind: 'org' | 'super_org'
  }
): Promise<{ id: string; code: string }> {
  const code = mintJoinCode(opts.kind)
  const rows = await tx`
    insert into join_codes (org_id, code, created_by)
    values (${opts.orgId}, ${code}, ${opts.createdBy})
    returning id
  `
  const id = String(rows[0]!.id)
  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.createdBy,
    action: 'join_code.create',
    targetType: 'join_code',
    targetId: id,
  })
  return { id, code }
}

export async function getActiveJoinCode(
  tx: TxSql | DbHandle,
  orgId: string
): Promise<JoinCodeRow | null> {
  const rows = await tx`
    select id, org_id, code, revoked_at, created_at
    from join_codes
    where org_id = ${orgId} and revoked_at is null
    order by created_at desc
    limit 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    code: String(row.code),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
    createdAt: new Date(String(row.created_at)),
  }
}

/** Ensure one active code; always returns stored plaintext (fixes Copy→null). */
export async function ensureJoinCode(
  tx: TxSql,
  opts: { orgId: string; createdBy: string; kind: 'org' | 'super_org' }
): Promise<{ id: string; code: string; created: boolean }> {
  const active = await getActiveJoinCode(tx, opts.orgId)
  if (active) return { id: active.id, code: active.code, created: false }
  const created = await createJoinCode(tx, {
    orgId: opts.orgId,
    createdBy: opts.createdBy,
    kind: opts.kind,
  })
  return { id: created.id, code: created.code, created: true }
}

export async function revokeJoinCode(
  tx: TxSql,
  opts: { orgId: string; joinCodeId: string; actorUserId: string }
): Promise<'ok' | 'not_found'> {
  const rows = await tx`
    update join_codes
    set revoked_at = coalesce(revoked_at, now())
    where id = ${opts.joinCodeId} and org_id = ${opts.orgId}
    returning id
  `
  if (!rows.length) return 'not_found'
  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.actorUserId,
    action: 'join_code.deactivate',
    targetType: 'join_code',
    targetId: opts.joinCodeId,
  })
  return 'ok'
}

export async function regenerateJoinCode(
  tx: TxSql,
  opts: { orgId: string; actorUserId: string; kind: 'org' | 'super_org' }
): Promise<{ id: string; code: string }> {
  await tx`
    update join_codes
    set revoked_at = coalesce(revoked_at, now())
    where org_id = ${opts.orgId} and revoked_at is null
  `
  const created = await createJoinCode(tx, {
    orgId: opts.orgId,
    createdBy: opts.actorUserId,
    kind: opts.kind,
  })
  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.actorUserId,
    action: 'join_code.regenerate',
    targetType: 'join_code',
    targetId: created.id,
  })
  return created
}

/** Lookup join target by plaintext code (for update). */
export async function lookupJoinCode(
  tx: TxSql,
  code: string
): Promise<JoinCodeOrg | null> {
  const trimmed = code.trim()
  if (!trimmed) return null
  const rows = await tx`
    select
      jc.id as join_code_id,
      jc.revoked_at,
      o.id as org_id,
      o.public_id,
      o.kind,
      o.parent_id,
      o.name
    from join_codes jc
    join organizations o on o.id = jc.org_id
    where jc.code = ${trimmed}
    for update of jc
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  return {
    joinCodeId: String(row.join_code_id),
    orgId: String(row.org_id),
    publicId: String(row.public_id),
    kind: row.kind as 'org' | 'super_org',
    parentId: (row.parent_id as string | null) ?? null,
    name: String(row.name),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
  }
}

export type JoinAsMemberFail =
  | 'invalid_code'
  | 'revoked'
  | 'already_member'
  | 'rate_limited'

export type JoinAsMemberResult =
  | { ok: true; orgId: string; role: 'member' }
  | { ok: false; code: JoinAsMemberFail }

async function bumpJoinRate(tx: TxSql, userId: string, nowMs: number): Promise<boolean> {
  const rows = await tx`
    select window_start_ms, count from join_rate_limits where user_id = ${userId} for update
  `
  const row = rows[0] as { window_start_ms: number | string; count: number } | undefined
  let windowStart = row ? Number(row.window_start_ms) : nowMs
  let count = row ? Number(row.count) : 0
  if (!row || nowMs - windowStart >= JOIN_RATE_WINDOW_MS) {
    windowStart = nowMs
    count = 0
  }
  if (count >= JOIN_RATE_MAX) return false
  count += 1
  await tx`
    insert into join_rate_limits (user_id, window_start_ms, count)
    values (${userId}, ${windowStart}, ${count})
    on conflict (user_id) do update set
      window_start_ms = excluded.window_start_ms,
      count = excluded.count
  `
  return true
}

/** True when the user already upgraded — personal-box join is individuals only. */
export async function userCannotJoinByCode(db: DbHandle, userId: string): Promise<boolean> {
  const rows = await db`
    select upgraded_org_id from users where id = ${userId}
  `
  return rows[0]?.upgraded_org_id != null
}

/** Insert/reactivate membership as member on an org (kind=org only at call site). */
export async function joinOrgAsMember(
  tx: TxSql,
  opts: { orgId: string; userId: string; now?: Date }
): Promise<JoinAsMemberResult> {
  const now = opts.now ?? new Date()
  const allowed = await bumpJoinRate(tx, opts.userId, now.getTime())
  if (!allowed) return { ok: false, code: 'rate_limited' }

  const existing = await tx`
    select status from memberships
    where org_id = ${opts.orgId} and user_id = ${opts.userId}
    for update
  `
  if (existing[0]?.status === 'active') return { ok: false, code: 'already_member' }

  if (existing[0]) {
    await tx`
      update memberships
      set role = 'member', status = 'active', created_at = now()
      where org_id = ${opts.orgId} and user_id = ${opts.userId}
    `
  } else {
    await tx`
      insert into memberships (org_id, user_id, role, status)
      values (${opts.orgId}, ${opts.userId}, 'member', 'active')
    `
  }

  return { ok: true, orgId: opts.orgId, role: 'member' }
}

export async function orgHasActiveMembers(
  tx: TxSql | DbHandle,
  orgId: string
): Promise<boolean> {
  const rows = await tx`
    select 1 from memberships
    where org_id = ${orgId} and status = 'active' and role = 'member'
    limit 1
  `
  return rows.length > 0
}
