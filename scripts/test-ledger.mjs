#!/usr/bin/env node
/**
 * Postgres-backed ledger checks + the 14-scenario Fal race suite.
 * Expects `npx supabase db reset` to have already run (fresh schema).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.OKVEVO_ENV ??= 'local'

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.ledgercheck.ts')) out.push(full)
  }
  return out
}

function run(rel) {
  console.log(`ledger: ${rel}`)
  const res = spawnSync('npx', ['tsx', rel], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

for (const file of walk(path.join(ROOT, 'src')).sort()) {
  run(path.relative(ROOT, file))
}

run('src/lib/fal/jobMachine.emulator.ts')
console.log('test:ledger: ok')
