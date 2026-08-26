/**
 * Harness core must not hardcode product skill ids. Allowlist: Skills/,
 * tier-3 pipeline tools, selfchecks, and the edu template root used by those tools.
 * Run: npx tsx checks/noSkillLiterals.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '../src');
const LITERALS = /\b(edu-video|talking-head)\b/;
const SKIP_DIR = `${path.sep}tools${path.sep}pipeline${path.sep}`;
const SKIP_FILES = new Set([
  path.join(SRC_ROOT, 'tools', 'lib', 'utils.ts'),
]);

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.selfcheck.ts')) continue;
    out.push(full);
  }
}

const files: string[] = [];
walk(SRC_ROOT, files);

const hits: string[] = [];
for (const file of files) {
  if (file.includes(SKIP_DIR)) continue;
  if (SKIP_FILES.has(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (LITERALS.test(line)) hits.push(`${path.relative(SRC_ROOT, file)}:${i + 1}:${line.trim()}`);
  });
}

assert.deepEqual(
  hits,
  [],
  `harness skill literals:\n${hits.join('\n')}`
);

console.log('noSkillLiterals.selfcheck: ok');
