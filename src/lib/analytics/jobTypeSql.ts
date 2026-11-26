import type { DbHandle } from '@/lib/db/wallet'
import { MEDIA_MODELS } from '@/lib/gateway/modelCatalog'

/** Same key customerModel() uses: requested model, else the billed model. */
export function customerModelKeySql(db: DbHandle) {
  return db`coalesce(nullif(requested_model, ''), model, '')`
}

/**
 * Customer label in SQL — mirrors customerModel() without a catalog name.
 * Used so a jobs filter on the label the customer saw still matches the row.
 */
export function customerLabelSql(db: DbHandle, key = customerModelKeySql(db)) {
  let whens = db`when ${key} = 'okvevo/auto-cost' then 'Auto · Cost-effective'
    when ${key} = 'okvevo/auto-intelligence' then 'Auto · Intelligence'
    when ${key} = 'openrouter/auto' or ${key} = 'openrouter/auto-beta' or ${key} = 'openrouter/pareto-code' then 'Auto'
    when ${key} = 'tavily-search' then 'Web search'
    when ${key} = 'tavily-extract' then 'Web extract'`
  for (const media of MEDIA_MODELS) {
    whens = db`${whens} when (${key} = ${media.prefix} or ${key} like ${media.prefix + '/%'}) then ${media.label}`
  }
  const human = db`initcap(replace(replace(split_part(${key}, '/', -1), '-', ' '), '_', ' '))`
  return db`case ${whens} when ${key} = '' then 'Unknown' else ${human} end`
}

/**
 * Customer job-type classification in SQL — mirrors customerModel():
 * Search (tavily) → media prefix (per-prefix Image/Video/Audio) → fal fallback Video → else Chat.
 * Ledger rows fall back to the billed model column. Job rows have no model
 * column: requested model, else the Fal endpoint, so the filter matches the
 * jobType listOrgJobs shows.
 */
export function jobTypeCaseSql(db: DbHandle, scope: 'ledger' | 'jobs') {
  const key =
    scope === 'ledger'
      ? customerModelKeySql(db)
      : db`coalesce(nullif(requested_model, ''), nullif(endpoint, ''), '')`
  let whens = db`when provider = 'tavily' or ${key} like 'tavily-%' then 'Search'`
  for (const media of MEDIA_MODELS) {
    whens = db`${whens} when (${key} = ${media.prefix} or ${key} like ${media.prefix + '/%'}) then ${media.jobType}`
  }
  return db`case ${whens} when provider = 'fal' then 'Video' else 'Chat' end`
}
