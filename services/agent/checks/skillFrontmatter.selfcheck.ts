/**
 * SKILL.md frontmatter: agentskills.io parsing, manifest merge/derivation,
 * and the drop-in guarantee (SKILL.md-only package, no skill.json).
 * Run: npx tsx checks/skillFrontmatter.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSkillFrontmatter, SKILLS_DIR } from '../src/skills';
import { listSkillIds, loadSkillManifest } from '../src/catalog/manifest';
import { buildTools, SAFE_TOOL_UNIVERSE } from '../src/tools';

// --- parser: full frontmatter ---
const parsed = parseSkillFrontmatter(`---
name: demo
description: >
  Folded first line
  second line.
allowed-tools:
  - read_file
  - run_command
metadata: { "tags": "a, b" }
---

# Body
`);
assert.equal(parsed.frontmatter.name, 'demo');
assert.equal(parsed.frontmatter.description, 'Folded first line second line.');
assert.deepEqual(parsed.frontmatter.allowedTools, ['read_file', 'run_command']);
assert.deepEqual(parsed.frontmatter.metadata, { tags: 'a, b' });
assert(parsed.body.startsWith('# Body'));

const nested = parseSkillFrontmatter(`---
name: nested
description: Nested metadata map.
metadata:
  editGuidance: references/a.md
  editTargets: references/b.md
---

# Nested
`);
assert.deepEqual(nested.frontmatter.metadata, {
  editGuidance: 'references/a.md',
  editTargets: 'references/b.md',
});

// --- parser: no frontmatter / unterminated → body passthrough ---
assert.equal(parseSkillFrontmatter('# No front').body, '# No front');
const unterminated = parseSkillFrontmatter('---\nname: x\n');
assert.equal(unterminated.frontmatter.name, undefined);
assert.equal(unterminated.body, '---\nname: x\n');

// --- all five shipped skills: frontmatter identity + in-universe tools ---
const shipped = [
  'background-generation',
  'edu-video',
  'hyperframes',
  'manim-video',
  'talking-head',
];
for (const id of shipped) {
  const manifest = loadSkillManifest(id);
  assert.equal(manifest.name, id, `${id}: frontmatter name must match folder`);
  assert.ok(manifest.description?.length, `${id}: description required`);
  const { frontmatter } = parseSkillFrontmatter(
    fs.readFileSync(path.join(SKILLS_DIR, id, 'SKILL.md'), 'utf-8')
  );
  for (const tool of frontmatter.allowedTools ?? []) {
    assert(
      SAFE_TOOL_UNIVERSE.includes(tool),
      `${id}: allowed-tools entry '${tool}' not in SAFE_TOOL_UNIVERSE`
    );
  }
}

// --- derived tool sets match the pre-refactor skill.json declarations ---
const edu = loadSkillManifest('edu-video');
assert.deepEqual(edu.tools, [
  'transcribe_video',
  'extract_concepts',
  'generate_manim_script',
  'render_manim_clip',
  'plan_segments',
  'scaffold_hf_project',
  'restore_generation',
  'render_hyperframes',
]);
assert.equal(edu.baseTools, undefined);

const talking = loadSkillManifest('talking-head');
assert.equal(talking.baseTools, undefined);
assert.deepEqual(talking.tools, [
  'transcribe_video',
  'scaffold_talking_head_project',
  'render_hyperframes',
]);
assert.deepEqual(talking.permissions, { allow: [] });

const background = loadSkillManifest('background-generation');
assert.deepEqual(background.baseTools, [
  'ask_clarification',
  'image_generate',
  'video_generate',
]);
assert.deepEqual(background.tools, []);

// --- skill.json is now optional: hyperframes + manim-video load without it ---
assert.equal(fs.existsSync(path.join(SKILLS_DIR, 'hyperframes', 'skill.json')), false);
assert.deepEqual(loadSkillManifest('hyperframes').tools, ['render_hyperframes']);
assert.deepEqual(loadSkillManifest('manim-video').tools, [
  'generate_manim_script',
  'render_manim_clip',
]);
assert.deepEqual(loadSkillManifest('manim-video').metadata, { version: '1.0.0' });

// --- drop-in fixture: SKILL.md-only package loads, gates tools, then cleans up ---
const fixtureId = '__frontmatter-fixture__';
const fixtureDir = path.join(SKILLS_DIR, fixtureId);
fs.mkdirSync(fixtureDir, { recursive: true });
try {
  fs.writeFileSync(
    path.join(fixtureDir, 'SKILL.md'),
    `---
name: ${fixtureId}
description: Drop-in fixture.
allowed-tools:
  - read_file
  - ask_clarification
---

Fixture body.
`
  );
  const manifest = loadSkillManifest(fixtureId);
  assert.equal(manifest.id, fixtureId);
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.tools, []);
  assert.deepEqual(manifest.baseTools, ['read_file', 'ask_clarification']);
  assert.deepEqual(manifest.phases, {});
  assert.ok(listSkillIds().includes(fixtureId));

  const tools = buildTools(
    {
      sessionId: 'frontmatter-fixture',
      userId: 'check',
      pipelineMode: 'auto',
      skillName: fixtureId,
      taggedArtifacts: [],
      restoreAllowlistUrls: [],
    },
    fixtureId
  );
  assert.deepEqual(Object.keys(tools).sort(), ['ask_clarification', 'read_file']);

  const badId = '__frontmatter-fixture-bad__';
  const badDir = path.join(SKILLS_DIR, badId);
  fs.mkdirSync(badDir, { recursive: true });
  try {
    fs.writeFileSync(
      path.join(badDir, 'SKILL.md'),
      `---\nname: wrong-name\ndescription: Mismatch.\n---\n\nBody.\n`
    );
    assert.throws(() => loadSkillManifest(badId), /does not match folder/);
  } finally {
    fs.rmSync(badDir, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

console.log('skillFrontmatter.selfcheck: ok');
