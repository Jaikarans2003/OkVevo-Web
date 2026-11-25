import type { DbHandle } from '@/lib/db/wallet'

/**
 * Customer Jobs / usage reads must not surface Fal request-id alias rows.
 * Alias rows exist so webhooks can look up by Fal id; the parent hold is the job.
 */
export function notAliasJob(db: DbHandle) {
  return db`alias_of is null`
}
