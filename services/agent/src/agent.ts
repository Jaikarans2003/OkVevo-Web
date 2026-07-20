import {
  streamText,
  stepCountIs,
  pipeUIMessageStreamToResponse,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from 'ai';
import type { ServerResponse } from 'node:http';
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
  persistPipelineMode,
  persistSkillId,
  type CheckpointAnswer,
  type CheckpointDisplayData,
  type LoadedCheckpoint,
} from './checkpoint';
import { pruneToolResults } from './messagePruning';
import { errorMessage } from './errorMessage';
import { getCachedSystemPrompt } from './systemPromptCache';
import { buildTools } from './tools';
import { resolveSkill } from './skills';
import { ensureSessionArtifacts, getSessionWorkdir } from './tools/lib/utils';
import {
  ensureSession,
  loadMessages,
  saveMessage,
  type StoredMessagePart,
} from './session';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export type RunAgentParams = {
  userMessage: string;
  sessionId: string;
  userId: string;
  videoUrl?: string;
  videoName?: string;
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

/** First concept fields for forced generate_manim_script after concepts Continue. */
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
    const duration = Math.max(1, end - start);
    return `
First concept to animate now:
- concept_name: ${first.concept_name}
- explanation: ${first.explanation}
- duration_seconds: ${duration}
Call generate_manim_script with these fields.`.trim();
  } catch {
    return '';
  }
}

function isConceptsApproveChoiceResume(checkpoint: LoadedCheckpoint): boolean {
  if (checkpoint.completedPhaseLabel !== 'Concepts extracted') return false;
  const type = checkpoint.answer?.type;
  return type === 'approve' || type === 'choice';
}

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
  let conceptsResumeForce = false;

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
        };
        await ensureSessionArtifacts(
          params.userId,
          params.sessionId,
          resumeCheckpoint.resume.artifactNeeds
        );
        resumeSystemAppend = buildResumeSystemContext(resumeCheckpoint);
        conceptsResumeForce = isConceptsApproveChoiceResume(resumeCheckpoint);
        if (conceptsResumeForce) {
          const hint = firstConceptResumeHint(params.sessionId);
          if (hint) {
            resumeSystemAppend = `${resumeSystemAppend}\n\n${hint}`;
          }
        }
      }
    }
  }

  const history = await loadMessages(params.sessionId, params.userId);

  let userContent = params.userMessage;
  if (params.videoUrl) {
    userContent += `\n\nVideo URL for processing: ${params.videoUrl}`;
  }

  await saveMessage(
    params.sessionId,
    params.userId,
    'user',
    userContent,
    undefined,
    params.videoUrl
      ? { videoUrl: params.videoUrl, videoName: params.videoName }
      : undefined
  );

  const messages: ModelMessage[] = pruneToolResults([
    ...history,
    { role: 'user', content: userContent },
  ]);

  const resolvedSkill = resolveSkill(params.skillId, params.userMessage);
  const effectiveSkill = resolvedSkill ?? sessionFields.skillId;
  if (resolvedSkill) await persistSkillId(params.sessionId, resolvedSkill);

  const modeBanner =
    effectiveMode === 'ask'
      ? 'Current mode: Ask-Me — pause and ask before major decisions.'
      : 'Current mode: Auto-Run — proceed autonomously without asking permission.';

  let systemPrompt = `${modeBanner}\n\n${getCachedSystemPrompt(params.sessionId, effectiveSkill)}`;
  if (resumeSystemAppend) {
    systemPrompt = `${systemPrompt}\n\n${resumeSystemAppend}`;
  }

  const modelId = params.model ?? 'anthropic/claude-sonnet-4-5';

  const toolCtx = {
    sessionId: params.sessionId,
    userId: params.userId,
    pipelineMode: effectiveMode,
    skillName: effectiveSkill ?? 'edu-video',
  };

  const tools = buildTools(toolCtx, { skill: effectiveSkill });

  if (conceptsResumeForce) {
    if (!('generate_manim_script' in tools)) {
      console.error('[agent] concepts resume force failed: generate_manim_script missing', {
        sessionId: params.sessionId,
        effectiveSkill,
        toolNames: Object.keys(tools),
      });
      throw new Error(
        'Concepts resume cannot proceed: generate_manim_script not in tool registry (skillId?)'
      );
    }
    console.log(
      `[agent] checkpoint.resume conceptsForce tx=ok skill=${effectiveSkill ?? 'null'} tool=generate_manim_script appendChars=${resumeSystemAppend.length}`
    );
  }

  let capturedCheckpointDisplay: CheckpointDisplayData | null = null;

  const result = streamText({
    model: openrouter(modelId),
    system: systemPrompt,
    messages,
    tools: tools as ToolSet,
    stopWhen: ({ steps }) => {
      if (stepsHitHaltTurn(steps)) return true;
      return stepCountIs(50)({ steps });
    },
    prepareStep: ({ stepNumber, messages: stepMessages }) => {
      const base = { messages: pruneToolResults(stepMessages) };
      // Concepts Continue (approve/choice) only — force first Manim tool on step 0
      if (
        conceptsResumeForce &&
        stepNumber === 0
      ) {
        return {
          ...base,
          toolChoice: {
            type: 'tool' as const,
            toolName: 'generate_manim_script',
          },
          activeTools: ['generate_manim_script'] as Array<
            'generate_manim_script'
          >,
        };
      }
      return base;
    },
    onStepFinish: ({ toolCalls, toolResults }) => {
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

  return { result, getCheckpointDisplay: () => capturedCheckpointDisplay };
}

function getTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function injectCheckpointPart(
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

export function pipeAgentStream(
  agentRun: Awaited<ReturnType<typeof runAgent>>,
  response: ServerResponse,
  params: { sessionId: string; userId: string }
) {
  const { result, getCheckpointDisplay } = agentRun;

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
