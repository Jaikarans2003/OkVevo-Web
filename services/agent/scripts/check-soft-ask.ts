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

  // Concepts Continue (approve/choice) may force toolChoice — nowhere else
  assert.match(
    agentSource,
    /conceptsResumeForce[\s\S]*toolChoice:\s*\{\s*type:\s*'tool'[\s\S]*toolName:\s*'generate_manim_script'/
  );
  assert.match(agentSource, /Concepts extracted/);
  assert.match(agentSource, /firstConceptResumeHint/);
  assert.match(
    agentSource,
    /checkpoint\.resume conceptsForce tx=ok skill=.*tool=generate_manim_script/
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
