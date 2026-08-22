/**
 * Catalog loader: all five skill.json validate; out-of-universe tools reject.
 * Run: npx tsx checks/catalog.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  lastSkillDispatch,
  listSkillIds,
  loadSkillManifest,
  TOOL_META,
  validateManifest,
} from '../src/catalog/manifest';
import { buildTools } from '../src/tools';
import { detectSkill } from '../src/skills';

const expected = [
  'background-generation',
  'edu-video',
  'hyperframes',
  'manim-video',
  'talking-head',
];
assert.deepEqual(listSkillIds(), expected);

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

assert.throws(
  () =>
    validateManifest(
      { id: 'x', tools: ['admin_delete_user'] },
      'x'
    ),
  /SAFE_TOOL_UNIVERSE/
);

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

console.log('catalog.selfcheck: ok');
