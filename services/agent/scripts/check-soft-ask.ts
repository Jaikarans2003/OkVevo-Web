// Self-check: soft ask_clarification checkpoint (Ask-Me guard + resume preamble shape).
// Run: npm run check-soft-ask (from services/agent)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function main() {
  assert.equal(formatDuration(125), '2:05');

  const checkpointSource = fs.readFileSync(
    path.join(__dirname, '../src/checkpoint.ts'),
    'utf-8'
  );
  const clarifySource = fs.readFileSync(
    path.join(__dirname, '../src/tools/general/clarify.ts'),
    'utf-8'
  );
  const eduSkillJson = fs.readFileSync(
    path.join(__dirname, '../../../Skills/edu-video/skill.json'),
    'utf-8'
  );
  const eduManifest = JSON.parse(eduSkillJson) as {
    phases: Record<
      string,
      {
        kind?: string;
        question?: string;
        choices?: { id: string; label: string }[];
        allowFreeform?: boolean;
        resume?: {
          revision?: string;
          approve?: string;
          forceToolName?: string;
          gateIfMissing?: { field: string; phaseKey: string };
          injectFiles?: string[];
        };
      }
    >;
  };
  const conceptsResume = eduManifest.phases['concepts-extracted']?.resume;
  const conceptsRevision = conceptsResume?.revision ?? '';
  const conceptsApprove = conceptsResume?.approve ?? '';

  assert.match(checkpointSource, /export async function writeAskCheckpoint/);
  assert.doesNotMatch(checkpointSource, /maybeWriteCheckpoint/);
  assert.doesNotMatch(checkpointSource, /checkpointDecl/);
  assert.match(
    checkpointSource,
    /Continue the pipeline from where you left off/
  );
  assert.doesNotMatch(checkpointSource, /Required next tool/);
  assert.match(conceptsApprove, /Do not ask for a video URL/);

  assert.match(clarifySource, /shouldPause\(ctx\.pipelineMode\)/);
  assert.match(clarifySource, /writeAskCheckpoint/);
  assert.doesNotMatch(clarifySource, /timeout_seconds/);

  const conceptsSource = fs.readFileSync(
    path.join(__dirname, '../src/tools/pipeline/concepts.ts'),
    'utf-8'
  );
  assert.match(conceptsSource, /writeAskCheckpoint/);
  assert.match(conceptsSource, /shouldPause\(ctx\.pipelineMode\)/);
  assert.match(conceptsSource, /resolveAutoField/);
  assert.doesNotMatch(conceptsSource, /persistOrientation\([^)]*'horizontal'/);
  // Approve path fixture: concepts gate is phase_gate only — no orientation choices
  assert.match(conceptsSource, /phase_label:\s*'Concepts extracted'/);
  assert.match(conceptsSource, /allowFreeform:\s*true/);
  assert.doesNotMatch(
    conceptsSource,
    /phase_label:\s*'Concepts extracted'[\s\S]*?choices:\s*\[[\s\S]*?horizontal/
  );

  const agentSource = fs.readFileSync(
    path.join(__dirname, '../src/agent.ts'),
    'utf-8'
  );
  assert.match(agentSource, /pipeUIMessageStreamToResponse/);
  assert.match(agentSource, /data-checkpoint/);
  assert.match(agentSource, /Current mode: Ask-Me/);
  assert.match(agentSource, /Current mode: Auto-Run/);
  assert.doesNotMatch(agentSource, /expectedNextTool/);
  assert.doesNotMatch(agentSource, /maybeWriteCheckpoint/);
  assert.doesNotMatch(agentSource, /checkpointDecl/);

  // Phase-4 purge: agent.ts carries zero skill/phase literals. Resume mechanics
  // are manifest-driven (lookupPhase/resolveResumeForce) or live on the hook bus.
  assert.match(agentSource, /haltAfterFirstStep/);
  assert.match(agentSource, /resolveResumeForce/);
  assert.match(agentSource, /resumeForceToolName/);
  assert.match(agentSource, /checkpoint\.resume force tx=ok skill=.*tool=/);
  for (const purged of [
    /isConceptsApproveResume/,
    /isOrientationChoiceResume/,
    /isPrePipelineResume/,
    /firstConceptResumeHint/,
    /VIDEO_ORIENTATION_CHECKPOINT/,
    /conceptsApproveChain/,
    /writeAskCheckpoint/,
    /Concepts extracted/,
    /Video orientation/,
    /Video preferences/,
    /orientationResumeForce/,
    /transcribeResumeForce/,
    /conceptsResumeForce/,
    /toolName:\s*'generate_manim_script'/,
  ]) {
    assert.doesNotMatch(agentSource, purged);
  }

  // The bus's CheckpointAnswered handler runs the generic resume mechanics.
  const handlersSource = fs.readFileSync(
    path.join(__dirname, '../src/hooks/handlers.ts'),
    'utf-8'
  );
  assert.match(handlersSource, /gateIfMissing/);
  assert.match(handlersSource, /injectFiles/);
  assert.match(handlersSource, /writeAskCheckpoint/);
  assert.match(handlersSource, /missingConfirmedFields/);
  assert.match(handlersSource, /persistClarificationAnswer/);
  for (const purged of [
    /isConceptsApproveResume/,
    /isOrientationChoiceResume/,
    /isPrePipelineResume/,
    /firstConceptResumeHint/,
    /VIDEO_ORIENTATION_CHECKPOINT/,
    /'Concepts extracted'/,
    /'Video orientation'/,
    /'Video preferences'/,
  ]) {
    assert.doesNotMatch(handlersSource, purged);
  }

  assert.equal(
    eduManifest.phases['concepts-extracted']?.resume?.forceToolName,
    'generate_manim_script'
  );
  assert.equal(
    eduManifest.phases['pre_pipeline']?.resume?.forceToolName,
    'transcribe_video'
  );
  assert.equal(
    eduManifest.phases['video-orientation']?.resume?.forceToolName,
    'generate_manim_script'
  );

  // Orientation gate is manifest-declared (moved out of TS in the phase-4 purge).
  const orientationPhase = eduManifest.phases['video-orientation'];
  assert.equal(orientationPhase?.kind, 'selection');
  assert.equal(
    orientationPhase?.question,
    'Choose video orientation to continue.'
  );
  assert.deepEqual(orientationPhase?.choices, [
    { id: 'horizontal', label: 'Horizontal (16:9)' },
    { id: 'vertical', label: 'Vertical (9:16)' },
  ]);
  assert.equal(orientationPhase?.allowFreeform, false);
  assert.deepEqual(orientationPhase?.resume?.injectFiles, ['concepts.json']);
  assert.deepEqual(
    eduManifest.phases['concepts-extracted']?.resume?.gateIfMissing,
    { field: 'orientation', phaseKey: 'video-orientation' }
  );
  assert.deepEqual(
    eduManifest.phases['concepts-extracted']?.resume?.injectFiles,
    ['concepts.json']
  );

  assert.match(conceptsRevision, /CONCEPTS REVISION RESUME — MANDATORY NEXT TOOL/);
  assert.match(conceptsRevision, /phase_label: "Video orientation"/);
  assert.match(conceptsRevision, /id: "horizontal"/);
  assert.match(conceptsRevision, /id: "vertical"/);
  assert.match(conceptsRevision, /allowFreeform: false/);
  assert.match(
    conceptsRevision,
    /Do NOT call generate_manim_script, render_manim_clip, extract_concepts, scaffold_hf_project, or render_hyperframes/
  );
  assert.match(
    conceptsRevision,
    /Do NOT invent a different clarification question or skip ask_clarification after edits/
  );

  // Ban pre-render / YAML-style hard gates
  assert.doesNotMatch(agentSource, /render_hyperframes['"]\s*,\s*activeTools/);
  assert.doesNotMatch(checkpointSource, /resume\.nextTool/);

  const sessionSource = fs.readFileSync(
    path.join(__dirname, '../src/session.ts'),
    'utf-8'
  );
  assert.match(sessionSource, /convertToModelMessages/);
  assert.match(sessionSource, /Video URL for processing/);

  console.log('check-soft-ask: ok');
}

main();
