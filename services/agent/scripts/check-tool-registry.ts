import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BASE_TOOLS,
  SKILL_TOOLS,
  SKILL_BASE_OVERRIDES,
  BASE_ONLY_SKILLS,
} from '../src/tools/catalog';
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
for (const [skill, tools] of Object.entries(SKILL_TOOLS)) {
  assertNoDuplicates(tools, `SKILL_TOOLS['${skill}']`);
}
for (const [skill, tools] of Object.entries(SKILL_BASE_OVERRIDES)) {
  assertNoDuplicates(tools, `SKILL_BASE_OVERRIDES['${skill}']`);
  assert(
    skill in SKILL_TOOLS || BASE_ONLY_SKILLS.includes(skill),
    `SKILL_BASE_OVERRIDES['${skill}'] has no matching SKILL_TOOLS / BASE_ONLY entry`
  );
}

const ctx = {
  sessionId: 'check-tool-registry',
  userId: 'check',
  pipelineMode: 'auto' as const,
  skillName: 'edu-video',
  taggedArtifacts: [],
};

const baseBuilt = buildTools(ctx);
for (const name of BASE_TOOLS) {
  assert(name in baseBuilt, `BASE_TOOLS tool '${name}' not in buildTools() output`);
}

for (const [skill, toolNames] of Object.entries(SKILL_TOOLS)) {
  const built = buildTools(ctx, [skill]);
  const expectedBase = SKILL_BASE_OVERRIDES[skill] ?? BASE_TOOLS;
  for (const name of [...expectedBase, ...toolNames]) {
    assert(name in built, `Skill '${skill}' buildTools missing '${name}'`);
  }
  if (SKILL_BASE_OVERRIDES[skill]) {
    assert(
      !('run_command' in built),
      `Skill '${skill}' must not expose run_command`
    );
  }
}

for (const skill of BASE_ONLY_SKILLS) {
  const built = buildTools(ctx, [skill]);
  const expectedBase = SKILL_BASE_OVERRIDES[skill] ?? BASE_TOOLS;
  assert.deepEqual(
    new Set(Object.keys(built)),
    new Set(expectedBase),
    `BASE_ONLY skill '${skill}' tool set mismatch`
  );
  if (SKILL_BASE_OVERRIDES[skill]) {
    assert(
      !('run_command' in built),
      `Skill '${skill}' must not expose run_command`
    );
  }
}

const additiveSkills = ['manim-video', 'hyperframes'];
const additiveBuilt = buildTools(ctx, additiveSkills);
const additiveExpected = new Set([
  ...BASE_TOOLS,
  ...SKILL_TOOLS['manim-video'],
  ...SKILL_TOOLS.hyperframes,
]);
assert.deepEqual(new Set(Object.keys(additiveBuilt)), additiveExpected);

const skillFolders = fs
  .readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')));

for (const folder of skillFolders) {
  const covered = folder in SKILL_TOOLS || BASE_ONLY_SKILLS.includes(folder);
  assert(
    covered,
    `Skills/${folder}/SKILL.md is not in SKILL_TOOLS or BASE_ONLY_SKILLS`
  );
}

console.log('check-tool-registry: OK');
