#!/usr/bin/env node
/**
 * Full check inventory (Phase J). Run from repo root: npm run check:all
 *
 * Covers: agent package.json check-* scripts, every *.selfcheck.ts under
 * services/agent and src, root check:env + check:fal-webhook, unwired
 * scripts/check-*, and Skills glob scripts/check-*.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENT = path.join(ROOT, 'services/agent');

const results = [];

function record(name, status, detail = '') {
  results.push({ name, status, detail });
  const tag = status === 'ok' ? 'ok  ' : status === 'skip' ? 'skip' : 'FAIL';
  console.log(`${tag}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function run(name, cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true', ...(opts.env ?? {}) },
    shell: false,
  });
  if (res.status === 0) record(name, 'ok');
  else {
    record(name, 'fail', `exit ${res.status ?? 'spawn'}`);
    return false;
  }
  return true;
}

function hasEnvKey(key) {
  if (process.env[key]) return true;
  for (const file of [path.join(ROOT, '.env'), path.join(AGENT, '.env')]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (new RegExp(`^${key}=.+$`, 'm').test(text)) return true;
  }
  return false;
}

function walk(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, pred, out);
    else if (pred(full, entry.name)) out.push(full);
  }
  return out;
}

// 1. Agent package.json check-* (skip alias check-skill-checkpoints)
const agentPkg = JSON.parse(fs.readFileSync(path.join(AGENT, 'package.json'), 'utf8'));
const agentChecks = Object.keys(agentPkg.scripts)
  .filter((k) => k.startsWith('check-') && k !== 'check-skill-checkpoints')
  .sort();

for (const script of agentChecks) {
  if (script === 'check-groq-connectivity' && !hasEnvKey('GROQ_API_KEY')) {
    record(`services/agent npm run ${script}`, 'skip', 'GROQ_API_KEY absent');
    continue;
  }
  run(`services/agent npm run ${script}`, 'npm', ['run', script], { cwd: AGENT });
}

// 2. *.selfcheck.ts under services/agent and src
const agentSelfchecks = walk(AGENT, (_p, name) => name.endsWith('.selfcheck.ts')).sort();
for (const file of agentSelfchecks) {
  const rel = path.relative(AGENT, file);
  run(rel, 'npx', ['tsx', rel], { cwd: AGENT });
}

const srcSelfchecks = walk(path.join(ROOT, 'src'), (_p, name) =>
  name.endsWith('.selfcheck.ts')
).sort();
for (const file of srcSelfchecks) {
  const rel = path.relative(ROOT, file);
  run(rel, 'npx', ['tsx', rel], { cwd: ROOT });
}

// Inline selfcheck in falSttIdempotency.ts (not a *.selfcheck.ts filename)
run(
  'src/falSttIdempotency.ts',
  'npx',
  ['tsx', 'src/falSttIdempotency.ts'],
  { cwd: AGENT }
);

// 3. Root env / fal webhook
run('check:env', 'npm', ['run', 'check:env'], { cwd: ROOT });
run('check:fal-webhook', 'npm', ['run', 'check:fal-webhook'], { cwd: ROOT });

// 4. Unwired agent scripts/check-*
const unwired = walk(path.join(AGENT, 'scripts'), (full, name) => {
  if (!/^check-/.test(name)) return false;
  const wired = Object.values(agentPkg.scripts).some((cmd) =>
    String(cmd).includes(name)
  );
  return !wired && (name.endsWith('.ts') || name.endsWith('.mjs') || name.endsWith('.sh'));
}).sort();

for (const file of unwired) {
  const rel = path.relative(AGENT, file);
  if (file.endsWith('check-extraction-gaps.ts')) {
    const transcript = process.env.CHECK_EXTRACTION_GAPS_TRANSCRIPT;
    if (!transcript) {
      record(
        rel,
        'skip',
        'live LLM; set CHECK_EXTRACTION_GAPS_TRANSCRIPT to invoke'
      );
      continue;
    }
    run(rel, 'npx', ['tsx', rel, transcript], { cwd: AGENT });
    continue;
  }
  if (file.endsWith('.sh')) run(rel, 'bash', [rel], { cwd: AGENT });
  else if (file.endsWith('.mjs')) run(rel, 'node', [rel], { cwd: AGENT });
  else run(rel, 'npx', ['tsx', rel], { cwd: AGENT });
}

// 5. Skills/**/scripts/check-*
const skillChecks = walk(path.join(ROOT, 'Skills'), (full, name) => {
  return (
    full.includes(`${path.sep}scripts${path.sep}`) &&
    /^check-/.test(name) &&
    (name.endsWith('.cjs') || name.endsWith('.js') || name.endsWith('.mjs'))
  );
}).sort();

for (const file of skillChecks) {
  const rel = path.relative(ROOT, file);
  const project = process.env.HYPERFRAMES_CHECK_PROJECT;
  if (!project) {
    record(
      rel,
      'skip',
      'needs project dir + HyperFrames deps; set HYPERFRAMES_CHECK_PROJECT to invoke'
    );
    continue;
  }
  run(rel, 'node', [file, project], { cwd: ROOT });
}

const failed = results.filter((r) => r.status === 'fail');
const skipped = results.filter((r) => r.status === 'skip');
console.log(
  `\ncheck:all  ${results.filter((r) => r.status === 'ok').length} ok, ${skipped.length} skipped, ${failed.length} failed`
);
for (const s of skipped) console.log(`  skip  ${s.name}  (${s.detail})`);
for (const f of failed) console.log(`  FAIL  ${f.name}  (${f.detail})`);
process.exit(failed.length ? 1 : 0);
