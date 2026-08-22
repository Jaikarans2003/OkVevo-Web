import {
  streamText,
  smoothStream,
  stepCountIs,
  pipeUIMessageStreamToResponse,
  createUIMessageStream,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from 'ai';
import type { ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  answerCheckpointTransaction,
  buildResumeSystemContext,
  CheckpointConflictError,
  clearPendingCheckpoint,
  getSessionPipelineFields,
  isHaltTurnOutput,
  loadCheckpoint,
  persistClarificationAnswer,
  persistPrePipelineAnswers,
  persistPipelineMode,
  persistSkillId,
  recordSkillsUsed,
  writeAskCheckpoint,
  missingConfirmedFields,
  type CheckpointAnswer,
  type CheckpointDisplayData,
  type LoadedCheckpoint,
} from './checkpoint';
import { detectAndApplyStyleSeed } from './skills-runtime/detectAndApplyStyleSeed';
import { pruneToolResults } from './messagePruning';
import { lookupPhase, resolveResumeForce } from './catalog/manifest';
import { errorMessage } from './errorMessage';
import { getCachedSystemPrompt } from './systemPromptCache';
import { FINAL_VIDEO_NAME_RE } from './finalVideoBasename';
import { buildTools } from './tools';
import { resolveSkill } from './skills';
import { isKnownSkill, skillsEngagedByToolCalls } from './sessionSkills';
import {
  ensureSessionArtifacts,
  getSessionWorkdir,
  resolveTaggedArtifacts,
  sessionArtifactPresent,
  type ArtifactNeed,
} from './tools/lib/utils';
import {
  formatReferencedAssets,
  selectProcessingMedia,
  type TaggedAsset,
} from './taggedAssets';
import {
  formatEditTargetsBlock,
  resolveEditTargets,
  shouldInjectEditTargets,
} from './editTargets';
import { listSessionManimClips } from './tools/lib/sessionManimClips';
import { getAssetUrl } from './storage';
import {
  ensureSession,
  loadMessages,
  saveMessage,
  type StoredMessagePart,
} from './session';
import {
  gateSessionTokens,
} from './sessionTokenGate';

export {
  SESSION_WARN_TOKENS,
  SESSION_HARD_LIMIT_TOKENS,
  SessionLimitReachedError,
  estimateMessageTokens,
  gateSessionTokens,
} from './sessionTokenGate';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export type RunAgentParams = {
  userMessage: string;
  sessionId: string;
  userId: string;
  videoUrl?: string;
  videoName?: string;
  taggedAssets?: TaggedAsset[];
  mediaUrls?: string[];
  mediaNames?: string[];
  model?: string;
  skillId?: string;
  pipelineMode?: 'ask' | 'auto';
  checkpointAnswer?: CheckpointAnswer;
};

function stepsHitHaltTurn(steps: { toolResults?: { output?: unknown }[] }[]): boolean {
  const last = steps.at(-1);
  return (
    last?.toolResults?.some((r) => isHaltTurnOutput(r.output)) ?? false
  );
}

/** First concept fields for forced generate_manim_script after Video orientation. */
function firstConceptResumeHint(sessionId: string): string {
  const conceptsPath = path.join(getSessionWorkdir(sessionId), 'concepts.json');
  if (!fs.existsSync(conceptsPath)) return '';
  try {
    const parsed = JSON.parse(fs.readFileSync(conceptsPath, 'utf-8')) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return '';
    const first = parsed[0] as {
      concept_name?: string;
      explanation?: string;
      start_seconds?: number;
      end_seconds?: number;
    };
    if (!first.concept_name || !first.explanation) return '';
    const start = typeof first.start_seconds === 'number' ? first.start_seconds : 0;
    const end = typeof first.end_seconds === 'number' ? first.end_seconds : start;
    const window_seconds = Math.max(1, end - start);
    return `
First concept to animate now:
- concept_name: ${first.concept_name}
- explanation: ${first.explanation}
- window_seconds: ${window_seconds}
Call generate_manim_script with these fields.`.trim();
  } catch {
    return '';
  }
}

function isConceptsApproveResume(checkpoint: LoadedCheckpoint): boolean {
  return (
    checkpoint.completedPhaseLabel === 'Concepts extracted' &&
    checkpoint.answer?.type === 'approve'
  );
}

function isOrientationChoiceResume(checkpoint: LoadedCheckpoint): boolean {
  if (checkpoint.completedPhaseLabel !== 'Video orientation') return false;
  const type = checkpoint.answer?.type;
  return type === 'approve' || type === 'choice';
}

function isPrePipelineResume(checkpoint: LoadedCheckpoint): boolean {
  return (
    checkpoint.completedPhaseLabel === 'Video preferences' ||
    checkpoint.completedPhase === 'pre_pipeline'
  );
}

const VIDEO_ORIENTATION_CHECKPOINT = {
  kind: 'single_select' as const,
  phase_label: 'Video orientation',
  question: 'Choose video orientation to continue.',
  choices: [
    { id: 'horizontal', label: 'Horizontal (16:9)' },
    { id: 'vertical', label: 'Vertical (9:16)' },
  ],
  allowFreeform: false as boolean,
};

export async function runAgent(params: RunAgentParams) {
  const pipelineMode = params.pipelineMode ?? 'ask';
  const title = params.userMessage.trim().slice(0, 80) || 'Untitled Chat';
  await ensureSession(params.sessionId, params.userId, title, {
    videoUrl: params.videoUrl,
    videoName: params.videoName,
  });
  await persistPipelineMode(params.sessionId, pipelineMode);

  const sessionFields = await getSessionPipelineFields(params.sessionId);
  const effectiveMode = pipelineMode ?? sessionFields.pipelineMode;

  let resumeCheckpoint: LoadedCheckpoint | null = null;
  let resumeSystemAppend = '';
  let conceptsApproveChain = false;
  let capturedCheckpointDisplay: CheckpointDisplayData | null = null;

  const isCancelMessage = /^(cancel|start over|new video)/i.test(params.userMessage.trim());
  if (isCancelMessage && sessionFields.pendingCheckpointId) {
    await clearPendingCheckpoint(params.sessionId);
  } else if (params.checkpointAnswer) {
    const txResult = await answerCheckpointTransaction(
      params.sessionId,
      params.checkpointAnswer.checkpointId,
      {
        type: params.checkpointAnswer.type,
        text: params.checkpointAnswer.text,
        choiceId: params.checkpointAnswer.choiceId,
        ...(params.checkpointAnswer.answers
          ? { answers: params.checkpointAnswer.answers }
          : {}),
      }
    );
    if (txResult === 'stale') {
      throw new CheckpointConflictError(
        'Checkpoint already answered in another tab or session'
      );
    }
    if (txResult === 'ok') {
      resumeCheckpoint = await loadCheckpoint(
        params.sessionId,
        params.checkpointAnswer.checkpointId
      );
      if (resumeCheckpoint) {
        resumeCheckpoint.answer = {
          type: params.checkpointAnswer.type,
          text: params.checkpointAnswer.text,
          choiceId: params.checkpointAnswer.choiceId,
          ...(params.checkpointAnswer.answers
            ? { answers: params.checkpointAnswer.answers }
            : {}),
        };
        await ensureSessionArtifacts(
          params.userId,
          params.sessionId,
          resumeCheckpoint.resume.artifactNeeds
        );
        resumeSystemAppend = buildResumeSystemContext(resumeCheckpoint);

        if (isPrePipelineResume(resumeCheckpoint)) {
          const answers =
            resumeCheckpoint.answer?.answers ??
            (resumeCheckpoint.answer?.choiceId
              ? {
                  [resumeCheckpoint.resume.questions?.[0]?.id ?? '0']: {
                    type: resumeCheckpoint.answer.type,
                    choiceId: resumeCheckpoint.answer.choiceId,
                    text: resumeCheckpoint.answer.text,
                  },
                }
              : {});
          await persistPrePipelineAnswers(
            params.sessionId,
            answers,
            resumeCheckpoint.resume.questions ?? []
          );
          resumeSystemAppend = `${resumeSystemAppend}\n\n- Preferences saved. Call transcribe_video with the session video URL next.`;
        } else if (isConceptsApproveResume(resumeCheckpoint)) {
          // Orientation already on session → skip second gate; force via phase.resume.forceToolName.
          const orientationMissing = await missingConfirmedFields(
            params.sessionId,
            ['orientation']
          );
          if (orientationMissing.length === 0) {
            const hint = firstConceptResumeHint(params.sessionId);
            if (hint) {
              resumeSystemAppend = `${resumeSystemAppend}\n\n${hint}`;
            }
          } else {
            const written = await writeAskCheckpoint(
              {
                sessionId: params.sessionId,
                userId: params.userId,
                skillName:
                  resumeCheckpoint.skillId ??
                  params.skillId ??
                  sessionFields.skillId ??
                  '',
                pipelineMode: effectiveMode,
              },
              { ...VIDEO_ORIENTATION_CHECKPOINT, phaseKey: 'video-orientation' }
            );
            capturedCheckpointDisplay = written.checkpointDisplay;
            conceptsApproveChain = true;
          }
        } else if (resumeCheckpoint.answer) {
          const choices =
            resumeCheckpoint.resume.questions?.[0]?.choices ??
            resumeCheckpoint.resume.question?.choices;
          await persistClarificationAnswer(
            params.sessionId,
            choices,
            resumeCheckpoint.answer
          );
          if (isOrientationChoiceResume(resumeCheckpoint)) {
            const hint = firstConceptResumeHint(params.sessionId);
            if (hint) {
              resumeSystemAppend = `${resumeSystemAppend}\n\n${hint}`;
            }
          }
        }
      }
    }
  }

  const history = await loadMessages(params.sessionId, params.userId);
  const taggedArtifacts = await resolveTaggedArtifacts(
    params.userId,
    params.sessionId,
    params.taggedAssets ?? []
  );

  const mediaUrls =
    params.mediaUrls && params.mediaUrls.length > 0
      ? params.mediaUrls
      : params.videoUrl
        ? [params.videoUrl]
        : [];
  const mediaNames = params.mediaNames ?? [];
  // When the user tagged assets, only those URLs are processing media — not untagged uploads/history.
  const processing = selectProcessingMedia(
    params.taggedAssets ?? [],
    mediaUrls,
    mediaNames
  );

  let userContent = params.userMessage;
  if (processing.urls.length === 1) {
    const label = processing.names[0] ? ` (${processing.names[0]})` : '';
    userContent += `\n\nMedia URL for processing${label}: ${processing.urls[0]}`;
  } else if (processing.urls.length > 1) {
    const lines = processing.urls.map((url, i) => {
      const name = processing.names[i] ? ` — ${processing.names[i]}` : '';
      return `${i + 1}.${name} ${url}`;
    });
    userContent += `\n\nMedia URLs for processing (in upload order — use these Firebase URLs directly; do not ask the user for links):\n${lines.join('\n')}`;
    userContent +=
      '\n\nIf compositing: prefer a .webm / transparent cutout as cutout_url and an image or opaque .mp4 as background_url.';
  }
  if ((params.taggedAssets ?? []).length > 0) {
    userContent +=
      '\n\nOnly use Referenced assets; do not use other session media or history URLs unless listed.';
  }
  const referencedAssets = formatReferencedAssets(taggedArtifacts);
  if (referencedAssets) {
    userContent += `\n\n${referencedAssets}`;
  }

  // FIX 0 / 0b: pre-resolve edit targets + inject fresh file bodies before tools run.
  {
    const workdir = getSessionWorkdir(params.sessionId);
    let hasHfProject = sessionArtifactPresent(workdir, 'hf_project');
    if (!hasHfProject) {
      try {
        hasHfProject = !!(await getAssetUrl(
          params.userId,
          params.sessionId,
          'hf_project'
        ));
      } catch {
        hasHfProject = false;
      }
    }
    const editTargets = resolveEditTargets({
      sessionId: params.sessionId,
      userMessage: params.userMessage,
      taggedArtifacts,
      workdir,
      hasHfProject,
    });
    if (shouldInjectEditTargets(editTargets)) {
      const needs: ArtifactNeed[] = [];
      if (
        editTargets.files.some((f) =>
          f.path.startsWith(editTargets.projectDir + path.sep)
        ) ||
        taggedArtifacts.some((a) =>
          FINAL_VIDEO_NAME_RE.test(path.basename(a.localPath))
        ) ||
        editTargets.orientationRebuild ||
        editTargets.restoreGeneration
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
        await ensureSessionArtifacts(params.userId, params.sessionId, needs);
      }
      const sessionManimClips = editTargets.orientationRebuild
        ? await listSessionManimClips(params.userId, params.sessionId)
        : undefined;
      const block = formatEditTargetsBlock(editTargets, undefined, {
        sessionManimClips,
      });
      if (block) userContent += `\n\n${block}`;
    }
  }

  const saveExtras: {
    videoUrl?: string;
    videoName?: string;
    taggedAssets?: TaggedAsset[];
  } = {};
  if (params.videoUrl) {
    saveExtras.videoUrl = params.videoUrl;
    saveExtras.videoName = params.videoName;
  }
  if ((params.taggedAssets ?? []).length > 0) {
    saveExtras.taggedAssets = params.taggedAssets;
  }

  // Prune + estimate before save so hard-limit turns never persist the new user message.
  const messages: ModelMessage[] = pruneToolResults([
    ...history,
    { role: 'user', content: userContent },
  ]);
  const { warning: sessionTokenWarning } = gateSessionTokens(
    messages,
    params.sessionId
  );

  // Persist display text only; media/edit-target injection stays on userContent for streamText.
  await saveMessage(
    params.sessionId,
    params.userId,
    'user',
    params.userMessage,
    undefined,
    Object.keys(saveExtras).length > 0 ? saveExtras : undefined
  );

  const resolvedSkill =
    (resumeCheckpoint?.skillId ? resumeCheckpoint.skillId : null) ??
    resolveSkill(params.skillId, params.userMessage) ??
    (isKnownSkill(sessionFields.skillId) ? sessionFields.skillId : null);

  const modeBanner =
    effectiveMode === 'ask'
      ? 'Current mode: Ask-Me — pause and ask before major decisions.'
      : 'Current mode: Auto-Run — proceed autonomously without asking permission.';

  let systemPrompt = `${modeBanner}\n\n${getCachedSystemPrompt(params.sessionId, resolvedSkill)}`;
  if (resumeSystemAppend) {
    systemPrompt = `${systemPrompt}\n\n${resumeSystemAppend}`;
  }

  const modelId = params.model ?? 'anthropic/claude-sonnet-4-6';

  const toolCtx = {
    sessionId: params.sessionId,
    userId: params.userId,
    pipelineMode: effectiveMode,
    skillName: resolvedSkill ?? '',
    taggedArtifacts,
    restoreAllowlistUrls: [] as string[],
  };

  const tools = buildTools(
    toolCtx,
    resolvedSkill,
    resumeCheckpoint ? 'gate-stamp' : 'new-turn'
  );

  let resumeForceToolName: string | null = null;
  if (
    resumeCheckpoint &&
    !conceptsApproveChain &&
    resolvedSkill &&
    resumeCheckpoint.answer?.type !== 'revision' &&
    resumeCheckpoint.answer?.type !== 'freeform'
  ) {
    const phaseKey =
      resumeCheckpoint.phaseKey ??
      lookupPhase(resolvedSkill, {
        completedPhaseLabel: resumeCheckpoint.completedPhaseLabel,
        completedPhase: resumeCheckpoint.completedPhase,
      })?.phaseKey;
    resumeForceToolName = resolveResumeForce(resolvedSkill, phaseKey);
    if (resumeForceToolName && !(resumeForceToolName in tools)) {
      console.error('[agent] resume force failed: tool missing from registry', {
        sessionId: params.sessionId,
        resolvedSkill,
        resumeForceToolName,
        toolNames: Object.keys(tools),
      });
      throw new Error(
        `Checkpoint resume cannot proceed: ${resumeForceToolName} not in tool registry (skillId?)`
      );
    }
    if (resumeForceToolName) {
      console.log(
        `[agent] checkpoint.resume force tx=ok skill=${resolvedSkill} tool=${resumeForceToolName} appendChars=${resumeSystemAppend.length}`
      );
    }
  }

  if (resolvedSkill) {
    const styleAppend = await detectAndApplyStyleSeed(
      params.sessionId,
      resolvedSkill,
      params.userMessage
    );
    if (styleAppend) {
      systemPrompt = `${systemPrompt}\n\n${styleAppend}`;
    }
  }

  const result = streamText({
    model: openrouter(modelId),
    system: systemPrompt,
    messages,
    tools: tools as ToolSet,
    experimental_transform: smoothStream({
      chunking: 'word',
      delayInMs: 18,
    }),
    stopWhen: ({ steps }) => {
      if (conceptsApproveChain && steps.length >= 1) return true;
      if (stepsHitHaltTurn(steps)) return true;
      return stepCountIs(50)({ steps });
    },
    prepareStep: ({ stepNumber, messages: stepMessages }) => {
      const base = { messages: pruneToolResults(stepMessages) };
      if (conceptsApproveChain) {
        return { ...base, activeTools: [] as string[] };
      }
      if (resumeForceToolName && stepNumber === 0) {
        return {
          ...base,
          toolChoice: {
            type: 'tool' as const,
            toolName: resumeForceToolName,
          },
          activeTools: [resumeForceToolName],
        };
      }
      return base;
    },
    onStepFinish: async ({ toolCalls, toolResults }) => {
      const engagedSkills = skillsEngagedByToolCalls(
        resolvedSkill,
        (toolCalls ?? []).map((call) => call.toolName)
      );
      if (engagedSkills.length > 0) {
        await recordSkillsUsed(params.sessionId, engagedSkills);
        await persistSkillId(params.sessionId, engagedSkills.at(-1)!);
      }
      for (const call of toolCalls ?? []) {
        console.log(
          `[agent] tool.call ${call.toolName}`,
          JSON.stringify({ input: call.input })
        );
      }
      for (const tr of toolResults ?? []) {
        const output =
          typeof tr.output === 'string'
            ? tr.output.slice(0, 300)
            : JSON.stringify(tr.output)?.slice(0, 300);
        console.log(
          `[agent] tool.result ${tr.toolName}`,
          JSON.stringify({ ok: true, outputPreview: output })
        );

        if (isHaltTurnOutput(tr.output) && tr.output.checkpointDisplay) {
          capturedCheckpointDisplay = tr.output.checkpointDisplay;
        }
      }
    },
  });

  return {
    result,
    getCheckpointDisplay: () => capturedCheckpointDisplay,
    sessionTokenWarning,
  };
}

function getTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function injectCheckpointPart(
  parts: StoredMessagePart[],
  display: CheckpointDisplayData | null
): StoredMessagePart[] {
  if (!display) return parts;
  const checkpointPart: StoredMessagePart = {
    type: 'data-checkpoint',
    data: display,
  };
  if (parts.some((p) => p.type === 'data-checkpoint')) return parts;
  return [...parts, checkpointPart];
}

/** One-shot assistant text for entry-gate short-circuit (message already persisted). */
export function pipeStaticAssistantText(
  response: ServerResponse,
  text: string
): void {
  const stream = createUIMessageStream({
    execute({ writer }) {
      const id = crypto.randomUUID();
      writer.write({ type: 'text-start', id });
      writer.write({ type: 'text-delta', id, delta: text });
      writer.write({ type: 'text-end', id });
    },
  });
  pipeUIMessageStreamToResponse({ response, stream });
}

export function pipeAgentStream(
  agentRun: Awaited<ReturnType<typeof runAgent>>,
  response: ServerResponse,
  params: { sessionId: string; userId: string }
) {
  const { result, getCheckpointDisplay, sessionTokenWarning } = agentRun;

  if (sessionTokenWarning) {
    response.setHeader('x-okvevo-session-token-warning', '1');
    response.setHeader(
      'x-okvevo-estimated-tokens',
      String(sessionTokenWarning.estimatedTokens)
    );
  }

  const uiStream = result.toUIMessageStream({
    onError: (error) => errorMessage(error),
    onFinish: async ({ responseMessage }) => {
      const text = getTextFromParts(responseMessage.parts);
      const checkpointDisplay = getCheckpointDisplay();
      const parts = injectCheckpointPart(
        responseMessage.parts as StoredMessagePart[],
        checkpointDisplay
      );

      if (!text.trim() && parts.length === 0) {
        return;
      }

      try {
        await saveMessage(
          params.sessionId,
          params.userId,
          'assistant',
          text,
          parts
        );
      } catch (err) {
        console.error('[agent] failed to persist assistant message parts:', err);
      }
    },
  });

  const withLiveParts = uiStream.pipeThrough(
    new TransformStream({
      start(controller) {
        if (sessionTokenWarning) {
          controller.enqueue({
            type: 'data-session-token-warning',
            data: { estimatedTokens: sessionTokenWarning.estimatedTokens },
          });
        }
      },
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
      flush(controller) {
        const display = getCheckpointDisplay();
        if (display) {
          controller.enqueue({ type: 'data-checkpoint', data: display });
        }
      },
    })
  );

  pipeUIMessageStreamToResponse({ response, stream: withLiveParts });
}
