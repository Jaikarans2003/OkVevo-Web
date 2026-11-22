/**
 * Append-only org audit rows (2b-a table; 2b-b invite/role actions).
 */
import type { TxSql } from '@/lib/db/tx'

export async function writeAuditLog(
  tx: TxSql,
  opts: {
    orgId: string
    actorUserId: string
    action: string
    targetType: string
    targetId?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await tx`
    insert into audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      ${opts.orgId},
      ${opts.actorUserId},
      ${opts.action},
      ${opts.targetType},
      ${opts.targetId ?? null},
      ${JSON.stringify(opts.metadata ?? {})}::jsonb
    )
  `
}