/**
 * Whole-tree checkpoint kind selfcheck:
 * - every writeAskCheckpoint( call declares kind + allowFreeform
 * - brand hex parse 1-hex / 2-hex
 * - renderer structure for kind × freeform (source asserts)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBrandColorsFromText, DEFAULT_BRAND_COLORS } from './tools/lib/utils.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = __dirname;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTsFiles(full, out);
    else if (ent.isFile() && ent.name.endsWith('.ts') && !ent.name.endsWith('.selfcheck.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Extract object-literal args for writeAskCheckpoint( / Batch questions. */
function assertCallSitesDeclareKindAndFreeform(src: string, file: string): void {
  // Skip the definition itself.
  if (
    /export async function writeAskCheckpoint\b/.test(src) ||
    /export async function writeAskCheckpointBatch\b/.test(src)
  ) {
    return;
  }

  const callRe = /writeAskCheckpoint(Batch)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(src))) {
    const from = m.index;
    const isBatch = Boolean(m[1]);
    const window = src.slice(from, from + 1600);

    // Batch: kind + allowFreeform live on each question (validated via questions.push below).
    if (isBatch) {
      if (!/\bquestions\b/.test(window)) {
        throw new Error(
          `${file}: writeAskCheckpointBatch missing questions near offset ${from}`
        );
      }
      continue;
    }

    const hasKind = /\bkind\s*:/.test(window);
    const hasFreeform = /\ballowFreeform\b/.test(window);
    if (hasKind && hasFreeform) continue;

    // Spread / pass-through of a file-local constant that itself declares both.
    const spread = window.match(/\.\.\.([A-Z][A-Z0-9_]*)\b/);
    const bare = window.match(
      /writeAskCheckpoint\s*\(\s*\{[\s\S]*?\}\s*,\s*([A-Z][A-Z0-9_]*)\s*\)/
    );
    const constName = spread?.[1] ?? bare?.[1];
    if (constName) {
      const constRe = new RegExp(
        `const ${constName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`
      );
      const body = src.match(constRe)?.[1] ?? '';
      if (/\bkind\s*:/.test(body) && /\ballowFreeform\s*:/.test(body)) continue;
    }

    if (!hasKind) {
      throw new Error(`${file}: writeAskCheckpoint call missing kind near offset ${from}`);
    }
    if (!hasFreeform) {
      throw new Error(
        `${file}: writeAskCheckpoint call missing allowFreeform near offset ${from}`
      );
    }
  }

  // Batch questions pushed as CheckpointQuestion objects should also declare both.
  if (/CheckpointQuestion/.test(src) && /questions\.push\(/.test(src)) {
    const pushBlocks = src.split(/questions\.push\(/).slice(1);
    for (const block of pushBlocks) {
      const obj = block.slice(0, 800);
      if (!/\bkind\s*:/.test(obj)) {
        throw new Error(`${file}: questions.push missing kind`);
      }
      if (!/\ballowFreeform\s*:/.test(obj)) {
        throw new Error(`${file}: questions.push missing allowFreeform`);
      }
    }
  }
}

function assertRendererStructure(): void {
  const uiPath = path.resolve(
    SRC_ROOT,
    '../../../src/components/workspace/ai-studio/CheckpointCard.tsx'
  );
  const ui = fs.readFileSync(uiPath, 'utf8');
  assert.match(ui, /kind === ['"]phase_gate['"]|kind: CheckpointKind/, 'UI knows phase_gate');
  assert.doesNotMatch(ui, /Recommended/, 'no Recommended tag');
  assert.doesNotMatch(ui, /scrub\(data\.title\)/, 'floating card must not render title heading');
  assert.doesNotMatch(ui, /<h4/, 'no h4 heading on checkpoint cards');
  assert.match(ui, /Continue/, 'phase_gate Continue');
  assert.match(ui, /Skip/, 'single_select Skip');
  assert.match(ui, /className="ml-auto[^"]*"[\s\S]{0,80}Skip|Skip[\s\S]{0,40}ml-auto/, 'Skip on right');
  // Freeform on both kinds via allowFreeform flag
  assert.match(ui, /allowFreeform/, 'freeform orthogonal flag');
  assert.doesNotMatch(ui, /Click Continue Or Customise/, 'no customize chrome');
}

function assertBrandParse(): void {
  const one = parseBrandColorsFromText('use #abc for brand');
  assert.deepEqual(one, {
    primary: '#aabbcc',
    accent: '#aabbcc',
    bg_dark: DEFAULT_BRAND_COLORS.bg_dark,
  });
  const two = parseBrandColorsFromText('#f97316 and #0a0a0a accents');
  assert.deepEqual(two, {
    primary: '#f97316',
    accent: '#0a0a0a',
    bg_dark: DEFAULT_BRAND_COLORS.bg_dark,
  });
  assert.equal(parseBrandColorsFromText('no colors here'), null);
}

function main() {
  assertBrandParse();
  assertRendererStructure();

  const files = walkTsFiles(SRC_ROOT);
  let callsFound = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/writeAskCheckpoint/.test(src)) continue;
    assertCallSitesDeclareKindAndFreeform(src, path.relative(SRC_ROOT, file));
    if (/writeAskCheckpoint(?:Batch)?\s*\(/.test(src) && !/export async function writeAskCheckpoint/.test(src)) {
      callsFound += 1;
    }
  }
  assert.ok(callsFound >= 4, `expected multiple call-site files, got ${callsFound}`);

  // VIDEO_ORIENTATION_CHECKPOINT constant
  const agentSrc = fs.readFileSync(path.join(SRC_ROOT, 'agent.ts'), 'utf8');
  assert.match(agentSrc, /VIDEO_ORIENTATION_CHECKPOINT[\s\S]*kind:\s*['"]single_select['"]/);
  assert.match(agentSrc, /VIDEO_ORIENTATION_CHECKPOINT[\s\S]*allowFreeform:\s*false/);

  console.log('checkpointKind.selfcheck: ok');
}

main();
