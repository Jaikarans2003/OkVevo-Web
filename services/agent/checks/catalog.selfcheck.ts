/**
 * Catalog loader: all five skill.json validate; out-of-universe tools reject.
 * Run: npx tsx checks/catalog.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  collectSkillsIndex,
  lastSkillDispatch,
  listSkillIds,
  loadSkillManifest,
  resolveEditConfig,
  skillsIndexPrompt,
  TOOL_META,
  validateManifest,
} from '../src/catalog/manifest';
import { detectSkill, SKILLS_DIR } from '../src/skills';
import { buildTools } from '../src/tools';

const expected = [
  'background-generation',
  'edu-video',
  'hyperframes',
  'manim-video',
  'talking-head',
];
assert.deepEqual(
  listSkillIds().filter((id) => !id.startsWith('__')),
  expected
);

for (const id of expected) {
  const manifest = loadSkillManifest(id);
  assert.equal(manifest.id, id);
  assert.equal(manifest.version, 1);
}
assert.equal(
  loadSkillManifest('edu-video').readyMessage,
  'Your educational video is ready.'
);
assert.equal(
  loadSkillManifest('talking-head').readyMessage,
  'Your talking-head video is ready.'
);

assert.deepEqual(loadSkillManifest('talking-head').triggers, [
  'talking-head',
  '/talking-head',
]);
assert.equal(detectSkill('please use /talking-head on this clip'), 'talking-head');
assert.equal(detectSkill('make an educational video'), 'edu-video');
assert.ok(TOOL_META.scaffold_talking_head_project);
assert.equal(TOOL_META.write_file.internal, true);
assert.equal(TOOL_META.scaffold_talking_head_project.internal, false);

assert.deepEqual(loadSkillManifest('edu-video').defaults, {
  orientation: 'horizontal',
  language: 'auto',
  animationStyle: 'moderate',
});
assert.equal(loadSkillManifest('talking-head').defaults?.language, 'auto');

assert.deepEqual(resolveEditConfig(loadSkillManifest('edu-video')), {
  editGuidance: '../shared/hyperframes-prompting-vocabulary.md',
  editTargets: 'references/edit-requests.md',
});
assert.equal(loadSkillManifest('edu-video').editGuidance, undefined);
assert.deepEqual(resolveEditConfig(loadSkillManifest('talking-head')), {
  editGuidance: '../shared/hyperframes-prompting-vocabulary.md',
  editTargets: 'references/edit-requests.md',
});
assert.deepEqual(resolveEditConfig(loadSkillManifest('__edit-config__')), {
  editGuidance: 'references/playbook.md',
  editTargets: 'references/playbook.md',
});
assert.equal(
  resolveEditConfig({
    id: 'x',
    version: 1,
    tools: [],
    triggers: [],
    phases: {},
    hooks: {},
    metadata: { editGuidance: 'from-fm.md', editTargets: 'from-fm-playbook.md' },
    editGuidance: 'from-json.md',
  }).editGuidance,
  'from-json.md'
);

assert.throws(
  () =>
    validateManifest(
      { id: 'x', tools: [], editGuidance: 'missing.md' },
      'x'
    ),
  /edit path missing/
);

assert.throws(
  () =>
    validateManifest(
      {
        id: 'x',
        tools: [],
        confirmedFields: ['orientation'],
        defaults: { orientation: 'sideways' },
      },
      'x'
    ),
  /defaults.orientation/
);

assert.throws(
  () =>
    validateManifest(
      { id: 'x', tools: ['admin_delete_user'] },
      'x'
    ),
  /SAFE_TOOL_UNIVERSE/
);

assert.throws(
  () =>
    validateManifest(
      {
        id: 'x',
        tools: [],
        hooks: {
          transcript_ready: {
            continuePrompt: 'go',
            forceToolName: 'write_file',
          },
        },
      },
      'x'
    ),
  /BASE_TOOL/
);

assert.throws(
  () =>
    validateManifest(
      {
        id: 'x',
        tools: [],
        phases: {
          gate: { label: 'G', resume: { forceToolName: 'write_file' } },
        },
      },
      'x'
    ),
  /BASE_TOOL/
);

assert.throws(
  () =>
    validateManifest(
      { id: 'x', tools: [], permissions: { deny: ['write_file(/tmp:*)'] } },
      'x'
    ),
  /only valid on run_command/
);

assert.throws(
  () =>
    validateManifest(
      { id: 'x', tools: [], permissions: { ask: ['admin_delete_user'] } },
      'x'
    ),
  /SAFE_TOOL_UNIVERSE/
);

assert.throws(
  () =>
    validateManifest(
      {
        id: 'x',
        tools: [],
        phases: {
          gate: { label: 'G', resume: { gateIfMissing: { field: 'f', phaseKey: 'nope' } } },
        },
      },
      'x'
    ),
  /not a declared phase/
);

assert.throws(
  () =>
    validateManifest(
      { id: 'x', tools: [], phases: { gate: { label: 'G', kind: 'phase_gate', choices: [{ id: 'a', label: 'A' }] } } },
      'x'
    ),
  /choices require kind 'selection'/
);

assert.throws(
  () =>
    validateManifest(
      { id: 'x', tools: [], phases: { gate: { label: 'G', kind: 'single_select' } } },
      'x'
    ),
  /requires non-empty choices/
);

// Every requiresConfirmedFields entry must be a field some skill declares.
const declaredFields = new Set<string>();
for (const id of expected) {
  for (const field of loadSkillManifest(id).confirmedFields ?? []) {
    declaredFields.add(field);
  }
}
for (const [toolName, meta] of Object.entries(TOOL_META)) {
  for (const field of meta.requiresConfirmedFields ?? []) {
    assert(
      declaredFields.has(field),
      `tool-meta '${toolName}' requiresConfirmedFields entry '${field}' is not declared by any skill`
    );
  }
}

const ctx = {
  sessionId: 'catalog-selfcheck',
  userId: 'check',
  pipelineMode: 'auto' as const,
  skillName: 'edu-video',
  taggedArtifacts: [],
  restoreAllowlistUrls: [],
};
buildTools(ctx, 'edu-video', 'new-turn');
const event = lastSkillDispatch();
assert(event, 'buildTools must emit skill.dispatch');
assert.equal(event.skillId, 'edu-video');
assert.equal(event.skillVersion, 1);
assert.equal(event.source, 'new-turn');
assert.equal(event.agentId, 'nia');

const index = collectSkillsIndex();
assert.deepEqual(
  index.map((entry) => entry.id),
  expected
);
assert.deepEqual(
  index.filter((entry) => entry.visibility === 'listed').map((entry) => entry.id),
  ['background-generation', 'edu-video', 'talking-head']
);
assert.equal(index.find((entry) => entry.id === 'edu-video')?.requiresUpload, true);
assert.equal(index.find((entry) => entry.id === 'talking-head')?.requiresUpload, true);
assert.equal(index.find((entry) => entry.id === 'background-generation')?.requiresUpload, false);
assert.equal(index.find((entry) => entry.id === 'hyperframes')?.visibility, 'internal');
assert.equal(index.find((entry) => entry.id === 'manim-video')?.visibility, 'internal');

const indexPrompt = skillsIndexPrompt(index);
assert.match(indexPrompt, /edu-video:/);
assert.match(indexPrompt, /talking-head:/);
assert.match(indexPrompt, /background-generation:/);
assert.doesNotMatch(indexPrompt, /hyperframes:/);
assert.doesNotMatch(indexPrompt, /manim-video:/);

const indexPath = path.join(SKILLS_DIR, 'index.json');
const serialized = `${JSON.stringify({ skills: index }, null, 2)}\n`;
const previous = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : '';
if (previous !== serialized) {
  fs.writeFileSync(indexPath, serialized);
  if (previous) {
    throw new Error(
      'Skills/index.json was stale and has been rewritten; commit it and re-run'
    );
  }
}

console.log('catalog.selfcheck: ok');
