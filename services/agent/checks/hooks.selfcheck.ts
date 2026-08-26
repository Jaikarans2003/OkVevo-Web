/**
 * Hook dispatcher: talking-head continue is not edu-video extract/Manim;
 * stamped job wins over session skill; missing hook is terminal (null).
 * Run: npx tsx checks/hooks.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lastSkillDispatch, loadSkillManifest, resolveResumeForce } from '../src/catalog/manifest';
import { resolveJobHook } from '../src/hooks/dispatch';
import { buildTools } from '../src/tools';

const talking = loadSkillManifest('talking-head');
const hook = talking.hooks.transcript_ready;
assert(hook, 'talking-head must define transcript_ready');
assert.equal(hook.askPhaseKey, undefined);
assert.equal(hook.forceToolName, undefined);
assert.doesNotMatch(hook.continuePrompt, /extract_concepts/);
assert.doesNotMatch(hook.continuePrompt, /generate_manim_script/);

const ctx = {
  sessionId: 'hooks-selfcheck',
  userId: 'check',
  pipelineMode: 'auto' as const,
  skillName: 'talking-head',
  taggedArtifacts: [],
  restoreAllowlistUrls: [],
};
const tools = buildTools(ctx, 'talking-head', 'job-stamp');
assert.equal('extract_concepts' in tools, false);
assert.equal('generate_manim_script' in tools, false);
assert.equal('scaffold_talking_head_project' in tools, true);

const emit = lastSkillDispatch();
assert(emit);
assert.equal(emit.skillId, 'talking-head');
assert.equal(emit.skillVersion, 1);
assert.equal(emit.source, 'job-stamp');

const resolved = resolveJobHook('transcript_ready', {
  skillId: 'talking-head',
  taskId: 'fal_stt',
  requestId: 'job-a',
});
assert(resolved, 'talking-head transcript_ready must resolve');
assert.equal(resolved.skillId, 'talking-head');
assert.doesNotMatch(resolved.hook.continuePrompt, /extract_concepts/);
assert.equal(resolved.hook.forceToolName, undefined);

assert.equal(
  resolveJobHook('transcript_ready', {
    skillId: 'manim-video',
    taskId: 'fal_stt',
    requestId: 'job-b',
  }),
  null
);

assert.throws(
  () =>
    resolveJobHook('transcript_ready', {
      taskId: 'fal_stt',
      requestId: 'unstamped',
    }),
  /missing skillId stamp/
);

const edu = loadSkillManifest('edu-video');
assert.equal(edu.hooks.transcript_ready?.askPhaseKey, 'lecture-heard');
assert.equal(edu.hooks.transcript_ready?.forceToolName, 'extract_concepts');
assert.match(
  edu.hooks.transcript_ready!.continuePrompt,
  /extract concepts/i
);

assert.equal(
  talking.phases.pre_pipeline?.resume?.forceToolName,
  'transcribe_video'
);
assert.equal(
  edu.phases['concepts-extracted']?.resume?.forceToolName,
  'generate_manim_script'
);
assert.equal(
  edu.phases['video-orientation']?.resume?.forceToolName,
  'generate_manim_script'
);

assert.equal(
  resolveResumeForce('talking-head', 'pre_pipeline'),
  'transcribe_video'
);
assert.equal(
  resolveResumeForce('edu-video', 'concepts-extracted'),
  'generate_manim_script'
);
assert.equal(resolveResumeForce('talking-head', 'storyboard-ready'), null);

const dispatchSrc = fs.readFileSync(
  path.join(__dirname, '../src/hooks/dispatch.ts'),
  'utf8'
);
assert.doesNotMatch(dispatchSrc, /userMessage:\s*hook\.continuePrompt/);
assert.match(dispatchSrc, /persistUser:\s*false/);
assert.match(dispatchSrc, /extraSystem:\s*hook\.continuePrompt/);
assert.match(dispatchSrc, /forceToolName:\s*hook\.forceToolName/);

const agentSrc = fs.readFileSync(path.join(__dirname, '../src/agent.ts'), 'utf8');
assert.match(agentSrc, /persistUser !== false/);
assert.match(agentSrc, /params\.forceToolName \?\? null/);
assert.match(agentSrc, /params\.extraSystem/);

console.log('hooks.selfcheck: ok');
