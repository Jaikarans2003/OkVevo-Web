import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BASE_TOOLS, SKILL_TOOLS, BASE_ONLY_SKILLS } from '../src/tools/catalog';
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

const ctx = { sessionId: 'check-tool-registry', userId: 'check' };

const baseBuilt = buildTools(ctx, {});
for (const name of BASE_TOOLS) {
  assert(name in baseBuilt, `BASE_TOOLS tool '${name}' not in buildTools() output`);
}

for (const [skill, toolNames] of Object.entries(SKILL_TOOLS)) {
  const built = buildTools(ctx, { skill });
  for (const name of [...BASE_TOOLS, ...toolNames]) {
    assert(name in built, `Skill '${skill}' buildTools missing '${name}'`);
  }
}

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
