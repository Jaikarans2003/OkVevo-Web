import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BASE_TOOLS,
  listSkillIds,
  loadSkillManifest,
  TOOL_META,
} from '../src/catalog/manifest';
import { assembleAllTools, buildTools, SAFE_TOOL_UNIVERSE } from '../src/tools';
import { SKILLS_DIR } from '../src/skills';

function assertNoDuplicates(names: string[], label: string) {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const dupes = [...counts.entries()].filter(([, count]) => count > 1);
  assert.equal(
    dupes.length,
    0,
    `${label} has duplicate tool names: ${dupes.map(([name]) => name).join(', ')}`
  );
}

assertNoDuplicates(BASE_TOOLS, 'BASE_TOOLS');

const ctx = {
  sessionId: 'check-tool-registry',
  userId: 'check',
  pipelineMode: 'auto' as const,
  skillName: 'edu-video',
  taggedArtifacts: [],
  restoreAllowlistUrls: [],
};

assert.deepEqual(
  [...SAFE_TOOL_UNIVERSE].sort(),
  Object.keys(assembleAllTools(ctx)).sort(),
  'SAFE_TOOL_UNIVERSE must equal assembleAllTools keys'
);
for (const name of SAFE_TOOL_UNIVERSE) {
  assert(name in TOOL_META, `TOOL_META missing entry for '${name}'`);
}
const srcRoot = path.join(__dirname, '../src');
assert(
  !fs
    .readFileSync(path.join(srcRoot, 'catalog/manifest.ts'), 'utf-8')
    .includes('export const SAFE_TOOL_UNIVERSE'),
  'SAFE_TOOL_UNIVERSE must not be hardcoded in catalog/manifest.ts'
);
const hfSrc = fs.readFileSync(
  path.join(srcRoot, 'tools/pipeline/hyperframes.ts'),
  'utf-8'
);
const thSrc = fs.readFileSync(
  path.join(srcRoot, 'tools/pipeline/talkingHead.ts'),
  'utf-8'
);
assert.doesNotMatch(hfSrc, /skillName \|\| ['"]edu-video['"]/);
assert.doesNotMatch(thSrc, /skillName \|\| ['"]talking-head['"]/);

const baseBuilt = buildTools(ctx);
for (const name of BASE_TOOLS) {
  assert(name in baseBuilt, `BASE_TOOLS tool '${name}' not in buildTools() output`);
}

for (const skill of listSkillIds().filter((id) => !id.startsWith('__'))) {
  const manifest = loadSkillManifest(skill);
  assertNoDuplicates(manifest.tools, `skill.json tools['${skill}']`);
  if (manifest.baseTools) {
    assertNoDuplicates(manifest.baseTools, `skill.json baseTools['${skill}']`);
  }
  const built = buildTools(ctx, skill);
  const expectedBase = manifest.baseTools ?? BASE_TOOLS;
  for (const name of [...expectedBase, ...manifest.tools]) {
    assert(name in built, `Skill '${skill}' buildTools missing '${name}'`);
  }
  assert.deepEqual(
    new Set(Object.keys(built)),
    new Set([...expectedBase, ...manifest.tools]),
    `Skill '${skill}' tool set mismatch`
  );
  if (manifest.baseTools) {
    assert(!('run_command' in built), `Skill '${skill}' must not expose run_command`);
  }
}

const talkingHead = buildTools(ctx, 'talking-head');
assert('run_command' in talkingHead, 'talking-head must expose run_command');

const skillFolders = fs
  .readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')));

for (const folder of skillFolders) {
  // skill.json is the optional workflow extension; a SKILL.md-only package must still load.
  loadSkillManifest(folder);
}

console.log('check-tool-registry: OK');
