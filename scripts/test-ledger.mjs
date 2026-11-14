#!/usr/bin/env node
/**
 * Runs the 14-scenario Fal job-machine race suite against local Postgres.
 * Expects `npx supabase db reset` to have already run (fresh schema).
 */
import { spawnSync } from 'node:child_process'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const result = spawnSync('npx', ['tsx', 'src/lib/fal/jobMachine.emulator.ts'], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(result.status ?? 1)
