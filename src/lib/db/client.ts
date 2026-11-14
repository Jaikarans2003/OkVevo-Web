/**
 * Server-only Postgres client (Supavisor transaction pooler, port 6543).
 * Browser / desktop never import this — they talk to OkVevo HTTP APIs only.
 * Lazy: first call throws if DATABASE_URL is missing outside local.
 */
import postgres from 'postgres'

import { isLocalMode, localDefault, required } from '@/config/env'

const globalForDb = globalThis as typeof globalThis & {
  __okvevoSql?: ReturnType<typeof postgres>
}

function createSql(): ReturnType<typeof postgres> {
  const local = isLocalMode()
  const url = local
    ? localDefault(
        'DATABASE_URL',
        'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
        process.env
      )
    : required('DATABASE_URL', process.env)
  return postgres(url, {
    prepare: false,
    ssl: local ? false : 'require',
    max: 5,
    idle_timeout: 20,
    // bigint columns here are ms-epoch timestamps, well under
    // Number.MAX_SAFE_INTEGER — parse as number, not postgres.js's default
    // string, so they round-trip like the Firestore numbers they replace.
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  })
}

function getSql(): ReturnType<typeof postgres> {
  if (!globalForDb.__okvevoSql) {
    globalForDb.__okvevoSql = createSql()
  }
  return globalForDb.__okvevoSql
}

/**
 * Module-scope client. postgres.js is a callable tagged template — Proxy
 * forwards calls and methods to the lazy instance.
 */
export const sql: ReturnType<typeof postgres> = new Proxy(function okvevoSql() {} as never, {
  apply(_target, _thisArg, argArray) {
    return Reflect.apply(getSql() as unknown as (...a: unknown[]) => unknown, getSql(), argArray)
  },
  get(_target, prop, _receiver) {
    const client = getSql() as unknown as Record<PropertyKey, unknown>
    const value = client[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
}) as ReturnType<typeof postgres>
