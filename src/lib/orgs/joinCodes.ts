/**
 * Join codes: one static member code per org (+ super-org team).
 */
import type { DbHandle } from '@/lib/db/wallet'
import type { TxSql } from '@/lib/db/tx'
import { writeAuditLog } from '@/lib/orgs/auditLog'
import { mintJoinCode, sha256Hex } from '@/lib/orgs/tokens'

const JOIN_RATE_WINDOW_MS = 60 * 60 * 1000
const JOIN_RATE_MAX = 30

export type JoinCodeRow = {
  id: string
  orgId: string
  uses: number
  revokedAt: Date | null
  createdAt: Date
}

export async function createJoinCode(
  tx: TxSql,
  opts: {
    orgId: string
    createdBy: string
    /** API must pass member only. */
    role?: 'member'
  }
): Promise<{ id: string; code: string }> {
  const code = mintJoinCode()
  const rows = await tx`
    insert into join_codes (org_id, code_hash, role, expires_at, max_uses, created_by)
    values (
      ${opts.orgId},
      ${sha256Hex(code)},
      'member',
      null,
      null,
      ${opts.createdBy}
    )
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
  tx: TxSql,
  orgId: string
): Promise<JoinCodeRow | null> {
  const rows = await tx`
    select id, org_id, uses, revoked_at, created_at
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
    uses: Number(row.uses),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
    createdAt: new Date(String(row.created_at)),
  }
}

/** Ensure one active code exists (no plaintext returned if already present). */
export async function ensureJoinCode(
  tx: TxSql,
  opts: { orgId: string; createdBy: string }
): Promise<{ id: string; code: string | null; created: boolean }> {
  const active = await getActiveJoinCode(tx, opts.orgId)
  if (active) return { id: active.id, code: null, created: false }
  const created = await createJoinCode(tx, { orgId: opts.orgId, createdBy: opts.createdBy })
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
  opts: { orgId: string; actorUserId: string }
): Promise<{ id: string; code: string }> {
  await tx`
    update join_codes
    set revoked_at = coalesce(revoked_at, now())
    where org_id = ${opts.orgId} and revoked_at is null
  `
  const created = await createJoinCode(tx, { orgId: opts.orgId, createdBy: opts.actorUserId })
  await writeAuditLog(tx, {
    orgId: opts.orgId,
    actorUserId: opts.actorUserId,
    action: 'join_code.regenerate',
    targetType: 'join_code',
    targetId: created.id,
  })
  return created
}

export type RedeemFail =
  | 'invalid_code'
  | 'expired'
  | 'revoked'
  | 'max_uses'
  | 'already_member'
  | 'rate_limited'
  | 'invalid_role'

export type RedeemResult =
  | { ok: true; orgId: string; role: string }
  | { ok: false; code: RedeemFail }

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

/** True when the user already upgraded — join-by-code is individuals only. */
export async function userCannotJoinByCode(db: DbHandle, userId: string): Promise<boolean> {
  const rows = await db`
    select upgraded_org_id from users where id = ${userId}
  `
  return rows[0]?.upgraded_org_id != null
}

export async function redeemJoinCode(
  tx: TxSql,
  opts: { code: string; userId: string; now?: Date }
): Promise<RedeemResult> {
  const now = opts.now ?? new Date()
  const allowed = await bumpJoinRate(tx, opts.userId, now.getTime())
  if (!allowed) return { ok: false, code: 'rate_limited' }

  const hash = sha256Hex(opts.code.trim())
  const rows = await tx`
    select id, org_id, role, expires_at, max_uses, uses, revoked_at
    from join_codes
    where code_hash = ${hash}
    for update
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return { ok: false, code: 'invalid_code' }
  if (row.revoked_at) return { ok: false, code: 'revoked' }
  const role = String(row.role)
  if (role !== 'member') return { ok: false, code: 'invalid_role' }
  const expiresAt =
    row.expires_at instanceof Date
      ? row.expires_at
      : row.expires_at
        ? new Date(String(row.expires_at))
        : null
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return { ok: false, code: 'expired' }
  const maxUses = row.max_uses == null ? null : Number(row.max_uses)
  const uses = Number(row.uses)
  if (maxUses != null && uses >= maxUses) return { ok: false, code: 'max_uses' }

  const orgId = String(row.org_id)

  const existing = await tx`
    select status from memberships
    where org_id = ${orgId} and user_id = ${opts.userId}
    for update
  `
  if (existing[0]?.status === 'active') return { ok: false, code: 'already_member' }

  if (existing[0]) {
    await tx`
      update memberships
      set role = 'member', status = 'active', created_at = now()
      where org_id = ${orgId} and user_id = ${opts.userId}
    `
  } else {
    await tx`
      insert into memberships (org_id, user_id, role, status)
      values (${orgId}, ${opts.userId}, 'member', 'active')
    `
  }

  await tx`update join_codes set uses = uses + 1 where id = ${String(row.id)}`

  return { ok: true, orgId, role: 'member' }
}