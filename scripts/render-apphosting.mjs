#!/usr/bin/env node
/**
 * Copy apphosting.{staging|production}.yaml → apphosting.yaml for App Hosting CLI.
 * Optional GitHub Environment vars overlay public `value:` entries by variable name.
 * Production refuses leftover CHANGE_ME / empty public values (fail-closed).
 *
 * Usage:
 *   node scripts/render-apphosting.mjs --env staging
 *   node scripts/render-apphosting.mjs --env production
 *   node scripts/render-apphosting.mjs --env production --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const PLACEHOLDER = 'CHANGE_ME'
const VALUE_BLOCK_RE =
  /(^[ \t]*- variable: ([A-Z0-9_]+)[ \t]*\r?\n[ \t]*value: )(\S[^\r\n]*)$/gm

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { env: '', dryRun: false, checkOnly: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--env' || a === '-e') {
      out.env = String(argv[++i] || '').trim()
    } else if (a === '--dry-run') {
      out.dryRun = true
    } else if (a === '--check' || a === '--check-only') {
      out.checkOnly = true
    } else if (a === '--help' || a === '-h') {
      out.help = true
    } else {
      throw new Error(`Unknown argument: ${a}`)
    }
  }
  return out
}

export function templatePath(envName, root = ROOT) {
  if (envName !== 'staging' && envName !== 'production') {
    throw new Error(`--env must be staging or production, got ${JSON.stringify(envName)}`)
  }
  return path.join(root, `apphosting.${envName}.yaml`)
}

export function applyEnvOverrides(yamlText, env = process.env) {
  return yamlText.replace(VALUE_BLOCK_RE, (full, prefix, name, current) => {
    const next = env[name]
    if (next == null || String(next).trim() === '') {
      return full
    }
    return `${prefix}${String(next).trim()}`
  })
}

export function leftoverPlaceholders(yamlText) {
  const hits = []
  for (const m of yamlText.matchAll(VALUE_BLOCK_RE)) {
    const name = m[2]
    const value = String(m[3] ?? '').trim().replace(/^["']|["']$/g, '')
    if (!value || value === PLACEHOLDER) {
      hits.push(name)
    }
  }
  return hits
}

export function renderApphosting({ envName, env = process.env, root = ROOT }) {
  const src = templatePath(envName, root)
  const raw = fs.readFileSync(src, 'utf8')
  const rendered = applyEnvOverrides(raw, env)
  if (envName === 'production') {
    const missing = leftoverPlaceholders(rendered)
    if (missing.length) {
      throw new Error(
        `Production apphosting.yaml still has ${PLACEHOLDER} or empty public values: ${missing.join(', ')}. ` +
          'Set GitHub Environment variables on `production` (same names as the YAML `variable:` keys) ' +
          'or edit apphosting.production.yaml. See docs/CI-CD.md.'
      )
    }
  }
  return rendered
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    const args = parseArgs()
    if (args.help || !args.env) {
      console.log(
        'Usage: node scripts/render-apphosting.mjs --env staging|production [--dry-run] [--check]'
      )
      process.exit(args.help ? 0 : 1)
    }
    const rendered = renderApphosting({ envName: args.env })
    const dest = path.join(ROOT, 'apphosting.yaml')
    if (args.checkOnly || args.dryRun) {
      console.log(`apphosting.${args.env}.yaml OK (${rendered.split('\n').length} lines)`)
      process.exit(0)
    }
    fs.writeFileSync(dest, rendered)
    console.log(`Wrote ${path.relative(ROOT, dest)} from apphosting.${args.env}.yaml`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
