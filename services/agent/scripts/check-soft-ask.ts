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

  assert.match(checkpointSource, /export async function writeAskCheckpoint/);
  assert.doesNotMatch(checkpointSource, /maybeWriteCheckpoint/);
  assert.doesNotMatch(checkpointSource, /checkpointDecl/);
  assert.match(
    checkpointSource,
    /Continue the pipeline from where you left off/
  );
  assert.doesNotMatch(checkpointSource, /Required next tool/);
  assert.match(checkpointSource, /Do not ask for a video URL/);

  assert.match(
    clarifySource,
    /if \(ctx\.pipelineMode !== 'ask'\)/,
    'Ask-Me guard must remain verbatim'
  );
  assert.match(clarifySource, /writeAskCheckpoint/);
  assert.doesNotMatch(clarifySource, /timeout_seconds/);

  const conceptsSource = fs.readFileSync(
    path.join(__dirname, '../src/tools/pipeline/concepts.ts'),
    'utf-8'
  );
  assert.match(conceptsSource, /writeAskCheckpoint/);
  assert.match(conceptsSource, /ctx\.pipelineMode === 'ask'/);
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
  assert.match(agentSource, /persistSkillId/);
  assert.match(agentSource, /pipeUIMessageStreamToResponse/);
  assert.match(agentSource, /data-checkpoint/);
  assert.match(agentSource, /Current mode: Ask-Me/);
  assert.match(agentSource, /Current mode: Auto-Run/);
  assert.doesNotMatch(agentSource, /expectedNextTool/);
  assert.doesNotMatch(agentSource, /maybeWriteCheckpoint/);
  assert.doesNotMatch(agentSource, /checkpointDecl/);

  // Approve path: concepts Continue writes Video orientation via writeAskCheckpoint
  assert.match(agentSource, /isConceptsApproveResume/);
  assert.match(agentSource, /writeAskCheckpoint/);
  assert.match(agentSource, /phase_label:\s*'Video orientation'/);
  assert.match(agentSource, /conceptsApproveChain/);

  // Manim force keyed off Video orientation only — not Concepts extracted
  assert.match(agentSource, /isOrientationChoiceResume/);
  assert.match(
    agentSource,
    /completedPhaseLabel !== 'Video orientation'/
  );
  assert.match(
    agentSource,
    /orientationResumeForce[\s\S]*toolChoice:\s*\{\s*type:\s*'tool'[\s\S]*toolName:\s*'generate_manim_script'/
  );
  assert.match(agentSource, /firstConceptResumeHint/);
  assert.match(
    agentSource,
    /checkpoint\.resume orientationForce tx=ok skill=.*tool=generate_manim_script/
  );
  assert.doesNotMatch(
    agentSource,
    /completedPhaseLabel !== 'Concepts extracted'[\s\S]{0,200}orientationResumeForce|conceptsResumeForce/
  );

  // Revision path fixture: directive preamble with exact ask_clarification payload
  assert.match(checkpointSource, /CONCEPTS REVISION RESUME — MANDATORY NEXT TOOL/);
  assert.match(checkpointSource, /phase_label: "Video orientation"/);
  assert.match(checkpointSource, /id: "horizontal"/);
  assert.match(checkpointSource, /id: "vertical"/);
  assert.match(checkpointSource, /allowFreeform: false/);
  assert.match(
    checkpointSource,
    /Do NOT call generate_manim_script, render_manim_clip, extract_concepts, scaffold_hf_project, or render_hyperframes/
  );
  assert.match(
    checkpointSource,
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
