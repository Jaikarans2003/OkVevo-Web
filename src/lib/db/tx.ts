/**
 * Interactive transactions with lock/statement timeouts and deadlock retry.
 * Lock order everywhere: billing_accounts → gateway_jobs → fal_queues.
 */
import type { Sql } from 'postgres'

import { sql } from '@/lib/db/client'

const RETRYABLE = new Set(['40P01', '55P03'])

/** Transaction client passed to withTx callbacks (same callable API as sql). */
export type TxSql = Sql

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pgCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

/**
 * Run `fn` inside sql.begin. Sets lock_timeout 5s and statement_timeout 10s.
 * Retries the whole transaction up to 3 times on deadlock (40P01) or lock
 * timeout (55P03) with jitter. After that, throws (callers map to 503).
 */
export async function withTx<T>(fn: (tx: TxSql) => Promise<T>): Promise<T> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await sql.begin(async (tx) => {
        await tx`set local lock_timeout = '5s'`
        await tx`set local statement_timeout = '10s'`
        return await fn(tx as unknown as TxSql)
      })
      return result as T
    } catch (err) {
      last = err
      const code = pgCode(err)
      if (!code || !RETRYABLE.has(code) || attempt === 2) throw err
      // ponytail: naive jitter; upgrade to exponential backoff if reserves get hot
      await sleep(25 + Math.floor(Math.random() * 50) * (attempt + 1))
    }
  }
  throw last
}
