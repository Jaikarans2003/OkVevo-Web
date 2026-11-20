/**
 * Join codes: create (plaintext once) / revoke / redeem (plan §6).
 */
import type { DbHandle } from '@/lib/db/wallet'
import type { TxSql } from '@/lib/db/tx'
import { mintJoinCode, sha256Hex } from '@/lib/orgs/tokens'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const JOIN_RATE_WINDOW_MS = 60 * 60 * 1000
const JOIN_RATE_MAX = 30

export type JoinCodeRow = {
  id: string
  orgId: string
  role: 'owner' | 'admin' | 'member'
  expiresAt: Date | null
  maxUses: number | null
  uses: number
  revokedAt: Date | null
}

export async function createJoinCode(
  tx: TxSql,
  opts: {
    orgId: string
    createdBy: string
    role?: 'admin' | 'member'
    expiresAt?: Date | null
    maxUses?: number | null
  }
): Promise<{ id: string; code: string; expiresAt: Date }> {
  const code = mintJoinCode()
  const expiresAt =
    opts.expiresAt === null
      ? null
      : opts.expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS)
  const role = opts.role ?? 'member'
  const rows = await tx`
    insert into join_codes (org_id, code_hash, role, expires_at, max_uses, created_by)
    values (
      ${opts.orgId},
      ${sha256Hex(code)},
      ${role},
      ${expiresAt},
      ${opts.maxUses ?? null},
      ${opts.createdBy}
    )
    returning id
  `
  return { id: String(rows[0]!.id), code, expiresAt: expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS) }
}

export async function revokeJoinCode(
  tx: TxSql,
  opts: { orgId: string; joinCodeId: string }
): Promise<'ok' | 'not_found'> {
  const rows = await tx`
    update join_codes
    set revoked_at = coalesce(revoked_at, now())
    where id = ${opts.joinCodeId} and org_id = ${opts.orgId}
    returning id
  `
  return rows.length ? 'ok' : 'not_found'
}

export type RedeemFail =
  | 'invalid_code'
  | 'expired'
  | 'revoked'
  | 'max_uses'
  | 'already_member'
  | 'rate_limited'

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
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : row.expires_at ? new Date(String(row.expires_at)) : null
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return { ok: false, code: 'expired' }
  const maxUses = row.max_uses == null ? null : Number(row.max_uses)
  const uses = Number(row.uses)
  if (maxUses != null && uses >= maxUses) return { ok: false, code: 'max_uses' }

  const orgId = String(row.org_id)
  const role = String(row.role)

  const existing = await tx`
    select status from memberships
    where org_id = ${orgId} and user_id = ${opts.userId}
    for update
  `
  if (existing[0]?.status === 'active') return { ok: false, code: 'already_member' }

  if (existing[0]) {
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
    update join_codes set uses = uses + 1 where id = ${String(row.id)}
  `

  return { ok: true, orgId, role }
}
