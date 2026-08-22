import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BASE_TOOLS,
  listSkillIds,
  loadSkillManifest,
} from '../src/catalog/manifest';
import { buildTools } from '../src/tools';
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

const baseBuilt = buildTools(ctx);
for (const name of BASE_TOOLS) {
  assert(name in baseBuilt, `BASE_TOOLS tool '${name}' not in buildTools() output`);
}

for (const skill of listSkillIds()) {
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
assert(!('run_command' in talkingHead), 'talking-head must not expose run_command');

const skillFolders = fs
  .readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')));

for (const folder of skillFolders) {
  const jsonPath = path.join(SKILLS_DIR, folder, 'skill.json');
  assert(fs.existsSync(jsonPath), `Skills/${folder}/SKILL.md is missing skill.json`);
  loadSkillManifest(folder);
}

console.log('check-tool-registry: OK');
