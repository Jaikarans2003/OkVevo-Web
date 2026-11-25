/**
 * Billable-route contract: exactly which API routes can reserve (hold) credits.
 * Static scan only — no DB. A route is billable when its transitive import
 * graph reaches a CALL of reserveCredits / reserveFalRun / applyReserve via a
 * named import of the symbol. Import-graph alone is not enough: webhooks/fal,
 * cron/fal-dispatch, cron/fal-drift and fal/quote all import handleQueue.ts,
 * but they import its settle/dispatch/quote exports — never the one export
 * (handleFalQueue) whose call chain reaches reserveFalRun — so per-consumer
 * the scan tracks which exported functions actually reach the reserve call.
 *
 * Run: npx tsx src/lib/gateway/billableRoutes.ledgercheck.ts
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ROOT = path.dirname(SRC)
const WALLET = 'src/lib/db/wallet.ts'
const CHECK_FILE = /\.(ledgercheck|selfcheck|emulator|test|spec)\.tsx?$/

const EXPECTED_BILLABLE = [
  'src/app/api/gateway/chat/completions/route.ts',
  'src/app/api/gateway/fal/queue/[...path]/route.ts',
  'src/app/api/gateway/tavily/[action]/route.ts',
]

/**
 * Files allowed to mention/import the personal-wallet reader getBillingByUserId
 * inside a billable graph. None of them use it to pick the PAYING wallet —
 * that is resolvePayingWallet's job (the wallet matrix ledgercheck asserts
 * settle follows job.billing_account_id):
 * - WALLET: the definition site.
 * - orgContext: resolvePayingWallet's sanctioned personal fallback (header absent).
 * - debit: grantCredits idempotent re-read; reserve paths lock resolvePayingWallet's id.
 * - handleQueue: fal queue slot/status VIEW (slotView) plus the legacy no-stamped-wallet
 *   fallback in the poll-time release gate; the gate itself checks the job's wallet
 *   (job.billing_account_id) via getBillingById, never the caller's personal plan.
 *   It never debits — the paying wallet comes from reserveFalRun → resolvePayingWallet.
 */
const ALLOWED_PERSONAL_READERS = new Set([
  WALLET,
  'src/lib/orgs/orgContext.ts',
  'src/lib/gateway/debit.ts',
  'src/lib/fal/handleQueue.ts',
])

/** Reserve entry symbols a billable route may call. */
const RESERVE_ENTRY_DEFS: Record<string, string> = {
  reserveCredits: 'src/lib/gateway/debit.ts',
  reserveFalRun: 'src/lib/gateway/debit.ts',
}
const APPLY_RESERVE_DEF = 'src/lib/gateway/reserve.ts'
// applyReserve is NOT an entry symbol: assertion 3 below pins it to debit.ts,
// so a route can only reach it through reserveCredits/reserveFalRun. Treating
// it as an entry would mark every route importing ANY debit export that
// internally calls applyReserve (e.g. handleQueue → reserveFalRun) billable.

type Edge = { to: string; names: Set<string>; kind: 'import' | 'export' | 'side' }

const absFiles: string[] = []
;(function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name)
    if (statSync(abs).isDirectory()) walk(abs)
    else if (/\.tsx?$/.test(name)) absFiles.push(abs)
  }
})(SRC)

const rel = (abs: string) => path.relative(ROOT, abs).split(path.sep).join('/')

function resolveSpec(fromAbs: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromAbs), spec)
  else return null
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.d.ts`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]
  if (base.endsWith('.js')) candidates.unshift(`${base.slice(0, -3)}.ts`)
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return rel(c)
  }
  return null
}

/** Named specifiers from an import/export clause; '*' for namespace/star forms. */
function parseNames(clause: string | undefined): Set<string> {
  const names = new Set<string>()
  if (!clause) return names
  const braces = clause.match(/\{([^}]*)\}/)
  if (braces) {
    for (let part of braces[1]!.split(',')) {
      part = part.trim().replace(/^type\s+/, '')
      if (part) names.add(part.split(/\s+as\s+/)[0]!.trim())
    }
  } else if (/\*\s+as\s+\w+/.test(clause) || clause.trim() === '*') {
    names.add('*')
  }
  return names
}

/** Comments stripped, for text backstops (doc comments are not references). */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

const edges = new Map<string, Edge[]>()
const sources = new Map<string, string>()
const stripped = new Map<string, string>()
for (const abs of absFiles) {
  const text = readFileSync(abs, 'utf8')
  const from = rel(abs)
  sources.set(from, text)
  stripped.set(from, stripComments(text))
  const list: Edge[] = []
  const add = (kind: Edge['kind'], names: Set<string>, spec: string) => {
    const to = resolveSpec(abs, spec)
    if (to) list.push({ to, names, kind })
  }
  for (const m of text.matchAll(/(import|export)\s+([^;()'"]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    add(m[1] as 'import' | 'export', parseNames(m[2]), m[3]!)
  }
  for (const m of text.matchAll(/import\s*['"]([^'"]+)['"]/g)) add('side', new Set(), m[1]!)
  for (const m of text.matchAll(
    /(?:const|let|var)\s*(\{[^}]*\})?\s*=\s*(?:await\s+)?import\(\s*['"]([^'"]+)['"]\s*\)/g
  )) {
    add('import', parseNames(m[1]), m[2]!)
  }
  edges.set(from, list)
}

/** defFile plus any file re-exporting the symbol (`export { s } from` / `export * from`). */
function exportersOf(symbol: string, defFile: string): Set<string> {
  const exporters = new Set([defFile])
  let grew = true
  while (grew) {
    grew = false
    for (const [file, list] of edges) {
      if (exporters.has(file)) continue
      for (const e of list) {
        if (e.kind === 'export' && exporters.has(e.to) && (e.names.size === 0 || e.names.has(symbol))) {
          exporters.add(file)
          grew = true
          break
        }
      }
    }
  }
  return exporters
}

/** Files with a named import of the symbol from an exporter ('*' = namespace import). */
function consumersOf(symbol: string, defFile: string): Set<string> {
  const exp = exportersOf(symbol, defFile)
  const out = new Set<string>()
  for (const [file, list] of edges) {
    if (exp.has(file)) continue
    for (const e of list) {
      if (e.kind === 'import' && exp.has(e.to) && (e.names.has(symbol) || e.names.has('*'))) {
        out.add(file)
        break
      }
    }
  }
  return out
}

type Decl = { name: string; exported: boolean; body: string }

/** Column-0 top-level fn/const decls; body = text until the next decl. */
function topLevelDecls(text: string): Decl[] {
  const lines = text.split('\n')
  const marks: { name: string; exported: boolean; start: number }[] = []
  lines.forEach((line, i) => {
    const m = line.match(
      /^(export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/
    )
    if (m) marks.push({ name: (m[2] ?? m[4])!, exported: Boolean(m[1] ?? m[3]), start: i })
  })
  return marks.map((d, i) => ({
    name: d.name,
    exported: d.exported,
    body: lines.slice(d.start, marks[i + 1]?.start ?? lines.length).join('\n'),
  }))
}

/**
 * Exported functions of `file` whose same-file call chain reaches `symbol(`.
 * ponytail: bodies are line-ranges between column-0 decls (no brace parsing),
 * and a call outside any decl (class method/module scope) marks every export.
 */
function reachingExports(file: string, symbol: string): Set<string> {
  const text = sources.get(file)!
  const call = new RegExp(`\\b${symbol}\\s*\\(`)
  if (!call.test(text)) return new Set()
  const decls = topLevelDecls(text)
  const reaching = new Set<string>()
  for (const d of decls) if (call.test(d.body)) reaching.add(d.name)
  if (reaching.size === 0) return new Set(decls.filter((d) => d.exported).map((d) => d.name))
  let grew = true
  while (grew) {
    grew = false
    for (const d of decls) {
      if (reaching.has(d.name)) continue
      for (const r of reaching) {
        if (new RegExp(`\\b${r}\\s*\\(`).test(d.body)) {
          reaching.add(d.name)
          grew = true
          break
        }
      }
    }
  }
  return new Set(decls.filter((d) => d.exported && reaching.has(d.name)).map((d) => d.name))
}

function closure(start: string): Set<string> {
  const seen = new Set([start])
  const stack = [start]
  while (stack.length > 0) {
    for (const e of edges.get(stack.pop()!) ?? []) {
      if (!seen.has(e.to)) {
        seen.add(e.to)
        stack.push(e.to)
      }
    }
  }
  return seen
}

// --- 2. Exactly three billable routes --------------------------------------
const consumersBySymbol = new Map<string, Map<string, Set<string>>>()
for (const [symbol, defFile] of Object.entries(RESERVE_ENTRY_DEFS)) {
  const m = new Map<string, Set<string>>()
  for (const file of consumersOf(symbol, defFile)) m.set(file, reachingExports(file, symbol))
  consumersBySymbol.set(symbol, m)
}

const routes = absFiles
  .map(rel)
  .filter((f) => f.includes('/app/api/') && f.endsWith('route.ts'))
const billable: string[] = []
for (const route of routes) {
  const seen = closure(route)
  let hits = false
  for (const symbolConsumers of consumersBySymbol.values()) {
    for (const [file, exported] of symbolConsumers) {
      if (!seen.has(file) || exported.size === 0) continue
      // The route file itself calls reserve inside an exported handler…
      if (file === route) {
        hits = true
        break
      }
      // …or some file in its graph imports a reserve-reaching export of the consumer.
      for (const g of seen) {
        const edge = (edges.get(g) ?? []).find(
          (e) =>
            e.kind === 'import' && e.to === file && [...e.names].some((n) => exported.has(n) || n === '*')
        )
        if (edge) {
          hits = true
          break
        }
      }
      if (hits) break
    }
    if (hits) break
  }
  if (hits) billable.push(route)
}
billable.sort()
assert.deepEqual(
  billable,
  EXPECTED_BILLABLE,
  `billable route set drifted; expected exactly chat/completions, tavily/[action], fal/queue/[...path]; got: ${billable.join(', ')}`
)

// --- 3. applyReserve is internal to the gateway reserve module --------------
const applyConsumers = [...consumersOf('applyReserve', APPLY_RESERVE_DEF)]
  .filter((f) => !CHECK_FILE.test(f))
  .sort()
assert.deepEqual(
  applyConsumers,
  ['src/lib/gateway/debit.ts'],
  `applyReserve must be called only from debit.ts; importers: ${applyConsumers.join(', ')}`
)
// Text backstop (covers namespace imports): no other production file even mentions it.
const applyMentions = [...sources.keys()]
  .filter(
    (f) =>
      !CHECK_FILE.test(f) &&
      f !== 'src/lib/gateway/debit.ts' &&
      f !== APPLY_RESERVE_DEF &&
      /\bapplyReserve\b/.test(stripped.get(f)!)
  )
  .sort()
assert.deepEqual(applyMentions, [], `applyReserve referenced outside debit.ts/reserve.ts: ${applyMentions.join(', ')}`)

// --- 4. No personal-wallet reader in the billable graphs --------------------
for (const route of EXPECTED_BILLABLE) {
  const seen = closure(route)
  const offenders = [...seen]
    .filter((f) => {
      if (ALLOWED_PERSONAL_READERS.has(f)) return false
      const importsIt = (edges.get(f) ?? []).some(
        (e) => e.kind === 'import' && e.to === WALLET && (e.names.has('getBillingByUserId') || e.names.has('*'))
      )
      // Text backstop for namespace-form calls (wallet.getBillingByUserId(...)).
      return importsIt || /\bgetBillingByUserId\b/.test(stripped.get(f)!)
    })
    .sort()
  assert.deepEqual(
    offenders,
    [],
    `${route}: personal-wallet reader in billable graph (paying wallet must come from resolvePayingWallet): ${offenders.join(', ')}`
  )
}

console.log('billableRoutes.ledgercheck: ok')
