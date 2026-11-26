/**
 * tsx entry so seedViaDatabase can import server code. Not the smoke main().
 * Usage: npx tsx e2e/billing-timeline-l2/seed-wallet.ts <org uuid or public id>
 */
import postgres from 'postgres'

import { seedViaDatabase } from '../../scripts/staging-org-smoke'

function redact(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-url]')
}

function connection(): { url: string; ssl: false | 'require' } {
  const url = (process.env.DATABASE_URL ?? '').trim()
  if (!url) throw new Error('DATABASE_URL unset')
  if (/radwdxigdywwdvizczho|okvevo-prod|text2video/i.test(url)) {
    throw new Error('refusing production database')
  }
  const host = new URL(url).hostname
  if (host === 'localhost' || host === '127.0.0.1') return { url, ssl: false }
  if (url.includes('wnbaxrmnnnfmrquwgsac')) return { url, ssl: 'require' }
  throw new Error('refusing database host')
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function orgUuid(arg: string): Promise<string> {
  if (UUID.test(arg)) return arg
  const { url, ssl } = connection()
  const sql = postgres(url, { ssl, max: 1, prepare: false })
  try {
    const rows = await sql`select id from organizations where public_id = ${arg}`
    const id = rows[0]?.id as string | undefined
    if (!id) throw new Error('org not found for public id')
    return id
  } finally {
    await sql.end({ timeout: 2 })
  }
}

const arg = process.argv[2]
if (!arg) throw new Error('org id required')

try {
  const orgId = await orgUuid(arg)
  const ok = await seedViaDatabase(orgId)
  if (!ok) throw new Error('seedViaDatabase returned false')
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(redact(message))
  process.exit(1)
}
