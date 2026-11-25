import type { DbHandle } from '@/lib/db/wallet'
import { MEDIA_MODELS } from '@/lib/gateway/modelCatalog'

/**
 * Customer job-type classification in SQL — mirrors customerModel():
 * Search (tavily) → media prefix (per-prefix Image/Video/Audio) → fal fallback Video → else Chat.
 * `scope` picks the raw model key expression: ledger rows fall back to the billed
 * model; job rows key on requested_model only (the same input listOrgJobs hands
 * customerModel), so a job_type filter always matches the listed jobType.
 */
export function jobTypeCaseSql(db: DbHandle, scope: 'ledger' | 'jobs') {
  const key =
    scope === 'ledger'
      ? db`coalesce(nullif(requested_model, ''), model, '')`
      : db`coalesce(requested_model, '')`
  let whens = db`when provider = 'tavily' or ${key} like 'tavily-%' then 'Search'`
  for (const media of MEDIA_MODELS) {
    whens = db`${whens} when (${key} = ${media.prefix} or ${key} like ${media.prefix + '/%'}) then ${media.jobType}`
  }
  return db`case ${whens} when provider = 'fal' then 'Video' else 'Chat' end`
}
