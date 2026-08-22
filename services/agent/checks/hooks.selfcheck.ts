/**
 * Hook dispatcher: talking-head continue is not edu-video extract/Manim;
 * stamped job wins over session skill; missing hook throws.
 * Run: npx tsx checks/hooks.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { lastSkillDispatch, loadSkillManifest, resolveResumeForce } from '../src/catalog/manifest';
import { resolveJobHook } from '../src/hooks/dispatch';
import { buildTools } from '../src/tools';

const talking = loadSkillManifest('talking-head');
const hook = talking.hooks.on_transcript_ready;
assert(hook, 'talking-head must define on_transcript_ready');
assert.equal(hook.askPhaseKey, undefined);
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

const resolved = resolveJobHook('on_transcript_ready', {
  skillId: 'talking-head',
  taskId: 'fal_stt',
  requestId: 'job-a',
});
assert.equal(resolved.skillId, 'talking-head');
assert.doesNotMatch(resolved.hook.continuePrompt, /extract_concepts/);

assert.throws(
  () =>
    resolveJobHook('on_transcript_ready', {
      skillId: 'manim-video',
      taskId: 'fal_stt',
      requestId: 'job-b',
    }),
  /has no hook/
);

assert.throws(
  () =>
    resolveJobHook('on_transcript_ready', {
      taskId: 'fal_stt',
      requestId: 'unstamped',
    }),
  /missing skillId stamp/
);

const edu = loadSkillManifest('edu-video');
assert.equal(edu.hooks.on_transcript_ready?.askPhaseKey, 'lecture-heard');
assert.match(
  edu.hooks.on_transcript_ready!.continuePrompt,
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

console.log('hooks.selfcheck: ok');
