import fs from 'node:fs';
import path from 'node:path';
import {
  buildResumeSystemContext,
  isHaltTurnOutput,
  missingConfirmedFields,
  persistClarificationAnswer,
  persistPrePipelineAnswers,
  persistSkillId,
  recordSkillsUsed,
  writeAskCheckpoint,
  writeAskFromPhase,
} from '../checkpoint';
import {
  getToolMeta,
  hasSkillManifest,
  loadSkillManifest,
  lookupPhase,
  resolveEditConfig,
  skillReadyMessage,
} from '../catalog/manifest';
import {
  formatEditTargetsBlock,
  looksLikeEditIntent,
  resolveEditTargets,
  shouldInjectEditTargets,
} from '../editTargets';
import { FINAL_VIDEO_NAME_RE } from '../finalVideoBasename';
import { shouldPause } from '../autonomy';
import { evaluateToolCall } from '../permissions';
import { saveMessage } from '../session';
import { skillsEngagedByToolCalls } from '../sessionSkills';
import { detectAndApplyStyleSeed } from '../skills-runtime/detectAndApplyStyleSeed';
import { SKILLS_DIR } from '../skills';
import { getAssetUrl, uploadFileToStorageKeepLocal } from '../storage';
import { assertManimMaxVisible, isManimScriptPath } from '../tools/lib/manimGuard';
import { isHfProjectPath, syncHfProjectFileAfterEdit } from '../tools/lib/hfProjectSync';
import { pickStrReplacePair } from '../tools/lib/strReplaceDecode';
import {
  ensureSessionArtifacts,
  getSessionWorkdir,
  resolveToolPath,
  sessionArtifactPresent,
  type ArtifactNeed,
} from '../tools/lib/utils';
import { onHook } from './bus';
import { dispatchJobCompleted } from './dispatch';

// --- UserPromptSubmit ---

// Moved verbatim from agent.ts turn start (FIX 0 / 0b).
onHook('UserPromptSubmit', async (event) => {
  const workdir = getSessionWorkdir(event.sessionId);
  let hasHfProject = sessionArtifactPresent(workdir, 'hf_project');
  if (!hasHfProject) {
    try {
      hasHfProject = !!(await getAssetUrl(
        event.userId,
        event.sessionId,
        'hf_project'
      ));
    } catch {
      hasHfProject = false;
    }
  }
  const editTargets = resolveEditTargets({
    sessionId: event.sessionId,
    userMessage: event.userMessage,
    taggedArtifacts: event.taggedArtifacts,
    workdir,
    hasHfProject,
  });
  const editConfig =
    event.skillId && hasSkillManifest(event.skillId)
      ? resolveEditConfig(loadSkillManifest(event.skillId))
      : {};
  const isEdit =
    looksLikeEditIntent(event.userMessage, hasHfProject) ||
    shouldInjectEditTargets(editTargets);
  const hasCfg = !!(editConfig.editGuidance || editConfig.editTargets);
  if (!shouldInjectEditTargets(editTargets) && !(isEdit && hasCfg)) return;
  const needs: ArtifactNeed[] = [];
  if (
    editTargets.files.some((f) =>
      f.path.startsWith(editTargets.projectDir + path.sep)
    ) ||
    event.taggedArtifacts.some((a) =>
      FINAL_VIDEO_NAME_RE.test(path.basename(a.localPath))
    ) ||
    editTargets.orientationRebuild ||
    editTargets.restoreGeneration ||
    (isEdit && hasCfg)
  ) {
    needs.push('hf_project');
  }
  if (
    editTargets.files.some((f) =>
      f.path.includes(`${path.sep}manim_scripts${path.sep}`)
    )
  ) {
    needs.push('manim_scripts');
  }
  if (needs.length > 0) {
    await ensureSessionArtifacts(event.userId, event.sessionId, needs);
  }
  const block = formatEditTargetsBlock(editTargets, undefined, {
    editConfig,
    skillDir: event.skillId ? path.join(SKILLS_DIR, event.skillId) : undefined,
  });
  if (block) event.userContent += `\n\n${block}`;
});

onHook('UserPromptSubmit', async (event) => {
  if (!event.skillId) return;
  const styleAppend = await detectAndApplyStyleSeed(
    event.sessionId,
    event.skillId,
    event.userMessage
  );
  if (styleAppend) event.systemAppends.push(styleAppend);
});

// --- PreToolUse ---

// Harness floor denies, then the skill's declarative permissions
// (deny → ask → allow matchers on run_command).
onHook('PreToolUse', async ({ toolName, args, ctx, manifest }) => {
  const { verdict, reason } = evaluateToolCall(manifest?.permissions, toolName, args);
  if (verdict === 'deny') {
    if (toolName === 'run_command') {
      return { block: { stdout: '', stderr: reason, exit_code: 1, success: false } };
    }
    return { block: { error: reason } };
  }
  if (verdict === 'ask') {
    if (!shouldPause(ctx.pipelineMode)) {
      console.log(`[agent] permission.ask auto-allow ${toolName} session=${ctx.sessionId}`);
      return;
    }
    const label = getToolMeta(toolName)?.friendlyLabel ?? toolName;
    const written = await writeAskCheckpoint(ctx, {
      kind: 'tool_approval',
      question: `Allow ${label}?`,
      phase_label: 'Permission',
      bullets: [label],
      choices: [
        { id: 'allow', label: 'Allow' },
        { id: 'deny', label: "Don't allow" },
      ],
      allowFreeform: false,
    });
    return {
      block: {
        haltTurn: true,
        checkpointId: written.checkpointId,
        checkpointDisplay: written.checkpointDisplay,
      },
    };
  }
});

// Ask-Me: block execute when tool-meta lists unset session fields.
onHook('PreToolUse', async ({ toolName, ctx }) => {
  const required = getToolMeta(toolName)?.requiresConfirmedFields;
  if (!required?.length) return;
  // ponytail: wrap in place; ceiling is one extra session read per gated tool call
  if (shouldPause(ctx.pipelineMode)) {
    const missing = await missingConfirmedFields(ctx.sessionId, required);
    if (missing.length > 0) {
      return {
        block: {
          error: `Missing confirmed fields for ${toolName}: ${missing.join(', ')}. Call ask_clarification once per field before retrying.`,
          missingFields: missing,
        },
      };
    }
  }
});


onHook('PreToolUse', ({ toolName, args, ctx }) => {
  if (toolName !== 'write_file' && toolName !== 'str_replace') return;
  const rec = args && typeof args === 'object' ? (args as Record<string, unknown>) : null;
  if (!rec || typeof rec.path !== 'string') return;
  const resolved = resolveToolPath(ctx.sessionId, rec.path);
  if (!isManimScriptPath(resolved)) return;

  let next: string | null = null;
  if (toolName === 'write_file') {
    if (typeof rec.content !== 'string') return;
    next = rec.content;
  } else {
    if (!fs.existsSync(resolved)) return;
    const current = fs.readFileSync(resolved, 'utf-8');
    if (typeof rec.old_string !== 'string' || typeof rec.new_string !== 'string') return;
    const picked = pickStrReplacePair(current, rec.old_string, rec.new_string);
    if (picked.matches !== 1) return;
    next = current.replace(picked.old_string, picked.new_string);
  }
  const error = assertManimMaxVisible(next);
  if (error) return { block: { error, path: resolved } };
});

// --- PostToolUse ---

onHook('PostToolUse', async (event) => {
  const engagedSkills = skillsEngagedByToolCalls(
    event.skillId,
    event.toolCalls.map((call) => call.toolName)
  );
  if (engagedSkills.length > 0) {
    await recordSkillsUsed(event.sessionId, engagedSkills);
    await persistSkillId(event.sessionId, engagedSkills.at(-1)!);
  }
});

onHook('PostToolUse', async (event) => {
  const n = Math.min(event.toolCalls.length, event.toolResults.length);
  for (let i = 0; i < n; i++) {
    const call = event.toolCalls[i]!;
    if (call.toolName !== 'write_file' && call.toolName !== 'str_replace') continue;
    const output = event.toolResults[i]?.output;
    if (output && typeof output === 'object' && output !== null && 'error' in output) continue;
    const input =
      call.input && typeof call.input === 'object'
        ? (call.input as Record<string, unknown>)
        : null;
    if (!input || typeof input.path !== 'string') continue;
    const resolved = resolveToolPath(event.sessionId, input.path);
    if (!isHfProjectPath(resolved)) continue;
    await syncHfProjectFileAfterEdit(
      event.userId,
      event.sessionId,
      resolved,
      uploadFileToStorageKeepLocal
    );
  }
});


onHook('PostToolUse', (event) => {
  for (const call of event.toolCalls) {
    console.log(
      `[agent] tool.call ${call.toolName}`,
      JSON.stringify({ input: call.input })
    );
  }
  for (const tr of event.toolResults) {
    const output =
      typeof tr.output === 'string'
        ? tr.output.slice(0, 300)
        : JSON.stringify(tr.output)?.slice(0, 300);
    console.log(
      `[agent] tool.result ${tr.toolName}`,
      JSON.stringify({ ok: true, outputPreview: output })
    );

    if (isHaltTurnOutput(tr.output) && tr.output.checkpointDisplay) {
      event.checkpointDisplay = tr.output.checkpointDisplay;
    }
  }
});

// --- JobCompleted ---

onHook('JobCompleted', dispatchJobCompleted);

// --- RenderCompleted ---

onHook('RenderCompleted', async (event) => {
  // Surface the finished video in chat — webhook/Check Now used to only write
  // Firestore fields, so the UI never got an assistant message with the player.
  try {
    const text = skillReadyMessage(event.skillId);
    await saveMessage(event.sessionId, event.userId, 'assistant', text, [
      { type: 'text', text },
    ], { videoUrl: event.videoUrl });
  } catch (err) {
    console.error('[finalize] failed to post draft video chat message:', err);
  }
});

// --- CheckpointAnswered ---

// Generic resume mechanics, zero skill/phase literals: restore artifacts, build
// resume context, persist the answer, then honor the manifest's declarative
// follow-ups — resume.gateIfMissing (chained gate for an unconfirmed field) and
// resume.injectFiles (session file heads into resume context).

const INJECT_FILE_HEAD_CHARS = 4000;

/** Heads of manifest-declared session files (resume.injectFiles) for resume context. */
function sessionFileHeadAppends(sessionId: string, files: string[]): string[] {
  const workdir = getSessionWorkdir(sessionId);
  const appends: string[] = [];
  for (const file of files) {
    const name = path.basename(file); // manifest data must not escape the workdir
    const filePath = path.join(workdir, name);
    if (!fs.existsSync(filePath)) continue;
    try {
      const head = fs
        .readFileSync(filePath, 'utf-8')
        .slice(0, INJECT_FILE_HEAD_CHARS)
        .trim();
      if (head) appends.push(`Session file ${name} (restored):\n${head}`);
    } catch {
      // unreadable file → skip its append
    }
  }
  return appends;
}

onHook('CheckpointAnswered', async (event) => {
  const checkpoint = event.checkpoint;
  await ensureSessionArtifacts(
    event.userId,
    event.sessionId,
    checkpoint.resume.artifactNeeds
  );
  event.systemAppends.push(buildResumeSystemContext(checkpoint));

  // The stamped skill owns the resume (async ownership invariant); fall back to
  // the turn's skill only for unstamped legacy checkpoints.
  const skillId =
    [checkpoint.skillId, event.skillIdParam, event.sessionSkillId].find(
      (id): id is string => typeof id === 'string' && hasSkillManifest(id)
    ) ?? null;
  const phase = skillId
    ? lookupPhase(skillId, {
        phaseKey: checkpoint.phaseKey,
        completedPhaseLabel: checkpoint.completedPhaseLabel,
        completedPhase: checkpoint.completedPhase,
      })?.phase
    : null;

  // Persist the answer: batch gates persist per-question; single gates via the
  // shared choice→field mapping.
  if (checkpoint.resume.questions?.length) {
    const answers =
      checkpoint.answer?.answers ??
      (checkpoint.answer?.choiceId
        ? {
            [checkpoint.resume.questions[0]!.id]: {
              type: checkpoint.answer.type,
              choiceId: checkpoint.answer.choiceId,
              text: checkpoint.answer.text,
            },
          }
        : {});
    await persistPrePipelineAnswers(
      event.sessionId,
      answers,
      checkpoint.resume.questions
    );
  } else if (checkpoint.answer && checkpoint.kind !== 'tool_approval') {
    const choices =
      checkpoint.resume.questions?.[0]?.choices ??
      checkpoint.resume.question?.choices;
    await persistClarificationAnswer(event.sessionId, choices, checkpoint.answer, {
      phaseKey: checkpoint.phaseKey,
      prompt: checkpoint.resume.question?.prompt,
    });
  }

  const answerType = checkpoint.answer?.type;
  const isContinueAnswer =
    checkpoint.kind !== 'tool_approval' &&
    (answerType === 'approve' || answerType === 'choice');

  // Chained gate: the answered phase declares a follow-up gate for a confirmed
  // field still missing on the session (revision/freeform answers stay
  // model-driven via the phase's resume.revision text instead).
  const gate = phase?.resume?.gateIfMissing;
  if (isContinueAnswer && gate && skillId) {
    const missing = await missingConfirmedFields(event.sessionId, [gate.field]);
    if (missing.length > 0) {
      // Non-null: validateManifest requires gateIfMissing.phaseKey to be declared.
      const gatePhase = lookupPhase(skillId, { phaseKey: gate.phaseKey })!.phase;
      const gateCtx = {
        sessionId: event.sessionId,
        userId: event.userId,
        skillName: skillId,
        pipelineMode: event.pipelineMode,
      };
      const written = await writeAskFromPhase(gateCtx, gatePhase, gate.phaseKey);
      event.checkpointDisplay = written.checkpointDisplay;
      event.haltAfterFirstStep = true;
      return;
    }
  }

  if (isContinueAnswer && phase?.resume?.injectFiles?.length) {
    event.systemAppends.push(
      ...sessionFileHeadAppends(event.sessionId, phase.resume.injectFiles)
    );
  }
});
