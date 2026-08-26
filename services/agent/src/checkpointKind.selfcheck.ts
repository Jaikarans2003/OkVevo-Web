/**
 * Whole-tree checkpoint kind selfcheck:
 * - every writeAskCheckpoint( call declares kind + allowFreeform
 * - brand hex parse 1-hex / 2-hex
 * - renderer structure for kind × freeform (source asserts)
 * - HITL: four kinds, no phase enum, no talking-head style type
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
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

/** Extract object-literal args for writeAskCheckpoint(. */
function assertCallSitesDeclareKindAndFreeform(src: string, file: string): void {
  if (/export async function writeAskCheckpoint\b/.test(src)) {
    return;
  }

  const callRe = /writeAskCheckpoint\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(src))) {
    const from = m.index;
    const window = src.slice(from, from + 1600);

    const hasKind = /\bkind\s*:/.test(window);
    const hasFreeform = /\ballowFreeform\b/.test(window);
    if (hasKind && hasFreeform) continue;

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
}

function assertRendererStructure(): void {
  const uiPath = path.resolve(
    SRC_ROOT,
    '../../../src/components/workspace/ai-studio/CheckpointCard.tsx'
  );
  const ui = fs.readFileSync(uiPath, 'utf8');
  assert.match(ui, /kind === ['"]approval['"]|asKind/, 'UI knows approval');
  assert.match(ui, /phase_gate/, 'UI still maps legacy phase_gate');
  assert.doesNotMatch(ui, /Recommended/, 'no Recommended tag');
  assert.doesNotMatch(ui, /<h4/, 'no h4 heading on checkpoint cards');
  assert.match(ui, /data\.bullets/, 'content bullets (e.g. concepts) still render');
  assert.match(ui, /Continue/, 'approval Continue');
  assert.match(ui, /Skip/, 'selection Skip');
  assert.match(ui, /className="ml-auto[^"]*"[\s\S]{0,80}Skip|Skip[\s\S]{0,40}ml-auto/, 'Skip on right');
  assert.match(ui, /allowFreeform/, 'freeform orthogonal flag');
  assert.doesNotMatch(ui, /Click Continue Or Customise/, 'no customize chrome');
  assert.match(ui, /Type your answer/, 'generic freeform fallback, not brand-only');
  assert.match(ui, /placeholderForQuestion/, 'placeholder follows the question');
  assert.match(ui, /Type a language/, 'language questions get a language hint');
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

function assertHitlGeneralization(checkpointSource: string): void {
  assert.match(checkpointSource, /export type CheckpointKind =/);
  assert.match(checkpointSource, /'approval'/);
  assert.match(checkpointSource, /'selection'/);
  assert.match(checkpointSource, /'elicitation'/);
  assert.match(checkpointSource, /'tool_approval'/);
  assert.match(checkpointSource, /export async function writeAskFromPhase/);
  assert.match(checkpointSource, /export function resolveResumeArtifacts/);
  assert.doesNotMatch(checkpointSource, /writeAskCheckpointBatch/);
  assert.doesNotMatch(checkpointSource, /loadPendingCheckpointDisplay/);
  assert.doesNotMatch(checkpointSource, /isPrePipelineResolved/);
  assert.doesNotMatch(checkpointSource, /export type CheckpointPhase/);
  assert.doesNotMatch(checkpointSource, /PHASE_NUMBERS/);
  assert.doesNotMatch(checkpointSource, /export type TalkingHeadStyle/);
  assert.doesNotMatch(checkpointSource, /persistTalkingHeadStyle/);
  assert.doesNotMatch(checkpointSource, /getSessionTalkingHeadStyle/);
  assert.doesNotMatch(checkpointSource, /skillName === 'talking-head'/);
  assert.match(checkpointSource, /export function defaultFreeformPlaceholder/);
}

function main() {
  assertBrandParse();
  assertRendererStructure();

  const checkpointSource = fs.readFileSync(path.join(SRC_ROOT, 'checkpoint.ts'), 'utf8');
  assertHitlGeneralization(checkpointSource);

  const files = walkTsFiles(SRC_ROOT);
  let callsFound = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/writeAskCheckpoint/.test(src)) continue;
    assertCallSitesDeclareKindAndFreeform(src, path.relative(SRC_ROOT, file));
    if (/writeAskCheckpoint\s*\(/.test(src) && !/export async function writeAskCheckpoint/.test(src)) {
      callsFound += 1;
    }
  }
  assert.ok(callsFound >= 3, `expected multiple call-site files, got ${callsFound}`);

  const eduManifest = JSON.parse(
    fs.readFileSync(
      path.resolve(SRC_ROOT, '../../../Skills/edu-video/skill.json'),
      'utf8'
    )
  ) as {
    phases?: Record<
      string,
      { kind?: string; allowFreeform?: boolean; choices?: unknown[] }
    >;
  };
  const orientation = eduManifest.phases?.['video-orientation'];
  assert.equal(orientation?.kind, 'selection');
  assert.equal(orientation?.allowFreeform, false);
  assert.ok(
    (orientation?.choices?.length ?? 0) >= 2,
    'video-orientation declares its choices'
  );
  assert.equal(eduManifest.phases?.['lecture-heard']?.kind, 'approval');
  assert.equal(eduManifest.phases?.['transcription-language']?.kind, 'selection');
  assert.equal(eduManifest.phases?.['transcription-paused']?.kind, 'selection');

  console.log('checkpointKind.selfcheck: ok');
}

main();
