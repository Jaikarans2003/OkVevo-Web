import {
  streamText,
  isStepCount,
  pipeUIMessageStreamToResponse,
  createUIMessageStream,
  JsonToSseTransformStream,
  UI_MESSAGE_STREAM_HEADERS,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from 'ai';
import type { ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  answerCheckpointTransaction,
  CheckpointConflictError,
  clearPendingCheckpoint,
  getSessionPipelineFields,
  isHaltTurnOutput,
  loadCheckpoint,
  type CheckpointAnswer,
  type CheckpointDisplayData,
  type LoadedCheckpoint,
} from './checkpoint';
import { pruneToolResults } from './messagePruning';
import { lookupPhase, resolveResumeForce } from './catalog/manifest';
import { errorMessage } from './errorMessage';
import {
  RunInProgressError,
  appendCoalesced,
  closeRun,
  openRun,
  type RunOrigin,
  type UiChunk,
} from './runLog';
import { afterCloseRun } from './autoContinue';
import { smoothStreamSkipStatus } from './smoothStreamSkipStatus';
import {
  getCachedSystemPrompt,
  systemPromptWithCache,
} from './systemPromptCache';
import { buildTools } from './tools';
import { resolveSkill } from './skills';
import { isKnownSkill } from './sessionSkills';
import { resolveTaggedArtifacts } from './tools/lib/utils';
import {
  formatReferencedAssets,
  selectProcessingMedia,
  type TaggedAsset,
} from './taggedAssets';
import {
  emitHook,
  type CheckpointAnsweredEvent,
  type PostToolUseEvent,
  type UserPromptSubmitEvent,
} from './hooks/bus';
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
export { RunInProgressError } from './runLog';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  // ponytail: log header time only; undici already pools (keepAliveTimeout 4s).
  fetch: (input, init) => {
    const t0 = Date.now();
    return fetch(input, init).then((res) => {
      console.info(`[agent] openrouter-headers ms=${Date.now() - t0}`);
      return res;
    });
  },
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
  persistUser?: boolean;
  extraSystem?: string;
  forceToolName?: string;
};

function stepsHitHaltTurn(steps: { toolResults?: { output?: unknown }[] }[]): boolean {
  const last = steps.at(-1);
  return (
    last?.toolResults?.some((r) => isHaltTurnOutput(r.output)) ?? false
  );
}

export async function runAgent(params: RunAgentParams) {
  const t0 = Date.now();
  const pipelineMode = params.pipelineMode ?? 'ask';
  const title = params.userMessage.trim().slice(0, 80) || 'Untitled Chat';
  const taggedAssets = params.taggedAssets ?? [];

  const sessionFieldsP = getSessionPipelineFields(params.sessionId);
  const historyP = loadMessages(params.sessionId, params.userId);
  const taggedP = resolveTaggedArtifacts(
    params.userId,
    params.sessionId,
    taggedAssets
  );
  const sessionWriteP = ensureSession(params.sessionId, params.userId, title, {
    videoUrl: params.videoUrl,
    videoName: params.videoName,
    pipelineMode,
  });

  const sessionFields = await sessionFieldsP;
  const effectiveMode = pipelineMode ?? sessionFields.pipelineMode;

  let resumeCheckpoint: LoadedCheckpoint | null = null;
  let resumeSystemAppend = '';
  let haltAfterFirstStep = false;
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
        const answered: CheckpointAnsweredEvent = {
          sessionId: params.sessionId,
          userId: params.userId,
          pipelineMode: effectiveMode,
          checkpoint: resumeCheckpoint,
          skillIdParam: params.skillId,
          sessionSkillId: sessionFields.skillId,
          systemAppends: [],
        };
        await emitHook('CheckpointAnswered', answered);
        if (answered.systemAppends.length > 0) {
          resumeSystemAppend = answered.systemAppends.join('\n\n');
        }
        if (answered.checkpointDisplay) {
          capturedCheckpointDisplay = answered.checkpointDisplay;
        }
        haltAfterFirstStep = answered.haltAfterFirstStep === true;
      }
    }
  }

  const [history, taggedArtifacts] = await Promise.all([
    historyP,
    taggedP,
    sessionWriteP,
  ]);

  const mediaUrls =
    params.mediaUrls && params.mediaUrls.length > 0
      ? params.mediaUrls
      : params.videoUrl
        ? [params.videoUrl]
        : [];
  const mediaNames = params.mediaNames ?? [];
  // When the user tagged assets, only those URLs are processing media — not untagged uploads/history.
  const processing = selectProcessingMedia(
    taggedAssets,
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
  if (taggedAssets.length > 0) {
    userContent +=
      '\n\nOnly use Referenced assets; do not use other session media or history URLs unless listed.';
  }
  const referencedAssets = formatReferencedAssets(taggedArtifacts);
  if (referencedAssets) {
    userContent += `\n\n${referencedAssets}`;
  }

  const resolvedSkill =
    (resumeCheckpoint?.skillId ? resumeCheckpoint.skillId : null) ??
    resolveSkill(params.skillId, params.userMessage) ??
    (isKnownSkill(sessionFields.skillId) ? sessionFields.skillId : null);

  // Turn-start hooks: edit-target injection (userContent) + style-seed
  // detection (systemAppends) live in hooks/handlers.ts.
  const promptEvent: UserPromptSubmitEvent = {
    sessionId: params.sessionId,
    userId: params.userId,
    userMessage: params.userMessage,
    skillId: resolvedSkill,
    taggedArtifacts,
    userContent,
    systemAppends: [],
  };
  await emitHook('UserPromptSubmit', promptEvent);
  userContent = promptEvent.userContent;

  const saveExtras: {
    videoUrl?: string;
    videoName?: string;
    taggedAssets?: TaggedAsset[];
  } = {};
  if (params.videoUrl) {
    saveExtras.videoUrl = params.videoUrl;
    saveExtras.videoName = params.videoName;
  }
  if (taggedAssets.length > 0) {
    saveExtras.taggedAssets = taggedAssets;
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
  // persistUser:false keeps the trailing user turn in-memory (never Firestore/UI).
  // Fire-and-forget: do not block streamText on the user-message write.
  if (params.persistUser !== false) {
    void saveMessage(
      params.sessionId,
      params.userId,
      'user',
      params.userMessage,
      undefined,
      Object.keys(saveExtras).length > 0 ? saveExtras : undefined
    ).catch((err) => {
      console.error('[agent] failed to persist user message:', err);
    });
  }

  const modeBanner =
    effectiveMode === 'ask'
      ? 'Current mode: Ask-Me — pause and ask before major decisions.'
      : 'Current mode: Auto-Run — proceed autonomously without asking permission.';

  const stableSystem = getCachedSystemPrompt(
    params.sessionId,
    resolvedSkill,
    modeBanner
  );
  const volatileSystem = [
    resumeSystemAppend,
    params.extraSystem,
    ...promptEvent.systemAppends,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('\n\n');

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

  let resumeForceToolName: string | null = params.forceToolName ?? null;
  if (
    !resumeForceToolName &&
    resumeCheckpoint &&
    !haltAfterFirstStep &&
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
  }
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

  const tPre = Date.now();
  const result = streamText({
    model: openrouter(modelId),
    instructions: systemPromptWithCache(stableSystem, volatileSystem),
    messages,
    tools: tools as ToolSet,
    // ponytail: transform is STATUS/word pacer on text-delta; StreamTextTransform wants TextStreamPart. Typed wrapper if we split this file from Next.
    experimental_transform: smoothStreamSkipStatus() as never,
    stopWhen: ({ steps }) => {
      if (haltAfterFirstStep && steps.length >= 1) return true;
      if (stepsHitHaltTurn(steps)) return true;
      return isStepCount(50)({ steps });
    },
    prepareStep: ({ stepNumber, messages: stepMessages }) => {
      const base = { messages: pruneToolResults(stepMessages) };
      if (haltAfterFirstStep) {
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
    onFinish: ({ usage }) => {
      const read = usage.inputTokenDetails?.cacheReadTokens ?? 0;
      const write = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
      console.info(
        `[agent] timing session=${params.sessionId} cache_read=${read} cache_write=${write}`
      );
    },
    onStepEnd: async ({ toolCalls, toolResults }) => {
      const postTool: PostToolUseEvent = {
        sessionId: params.sessionId,
        userId: params.userId,
        skillId: resolvedSkill,
        toolCalls: (toolCalls ?? []).map((call) => ({
          toolName: call.toolName,
          input: call.input,
        })),
        toolResults: (toolResults ?? []).map((tr) => ({
          toolName: tr.toolName,
          output: tr.output,
        })),
      };
      await emitHook('PostToolUse', postTool);
      if (postTool.checkpointDisplay) {
        capturedCheckpointDisplay = postTool.checkpointDisplay;
      }
    },
  });

  return {
    result,
    getCheckpointDisplay: () => capturedCheckpointDisplay,
    sessionTokenWarning,
    timing: { t0, tPre },
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
  const seq = typeof display.seq === 'number' ? display.seq : 0;
  const checkpointPart: StoredMessagePart = {
    type: 'data-checkpoint',
    id: display.checkpointId,
    data: display,
  };
  const idx = parts.findIndex((part) => {
    if (part.type !== 'data-checkpoint') return false;
    if (part.id === display.checkpointId) return true;
    const data = part.data as { checkpointId?: unknown } | undefined;
    return data?.checkpointId === display.checkpointId;
  });
  if (idx >= 0) {
    const existing = parts[idx]!;
    const existingSeq = (existing.data as { seq?: unknown } | undefined)?.seq;
    const stored = typeof existingSeq === 'number' ? existingSeq : 0;
    if (seq <= stored) return parts;
    const next = parts.slice();
    next[idx] = checkpointPart;
    return next;
  }
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

/** Drain the HTTP tee branch even if the client is gone so persist is not backpressured. */
async function pipeHttpUiStream(
  response: ServerResponse,
  stream: ReadableStream<unknown>
): Promise<void> {
  const bytes = stream
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(new TextEncoderStream());
  const reader = bytes.getReader();
  let httpAlive = true;
  const markDead = () => {
    httpAlive = false;
  };
  response.once('close', markDead);
  try {
    if (!response.headersSent) {
      response.writeHead(200, UI_MESSAGE_STREAM_HEADERS);
    }
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!httpAlive || response.writableEnded || !response.writable) continue;
      try {
        const canContinue = response.write(value);
        if (!canContinue && httpAlive) {
          await new Promise<void>((resolve) => {
            const finish = () => {
              response.off('drain', finish);
              response.off('close', onClose);
              resolve();
            };
            const onClose = () => {
              markDead();
              finish();
            };
            response.once('drain', finish);
            response.once('close', onClose);
          });
        }
      } catch (err) {
        console.error('[agent] UI HTTP pipe failed; log continues', err);
        httpAlive = false;
      }
    }
  } catch (err) {
    console.error('[agent] UI HTTP pipe failed; log continues', err);
    try {
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      // stream already closed
    }
  } finally {
    response.off('close', markDead);
    if (!response.writableEnded) {
      try {
        response.end();
      } catch {
        // ignore
      }
    }
  }
}

function buildLiveUiStream(
  agentRun: Awaited<ReturnType<typeof runAgent>>,
  params: { sessionId: string; userId: string }
) {
  const { result, getCheckpointDisplay, sessionTokenWarning, timing } = agentRun;
  let firstChunk = true;

  const uiStream = result.toUIMessageStream({
    onError: (error) => errorMessage(error),
    onEnd: async ({ responseMessage }) => {
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

  const flushedCheckpointIds = new Set<string>();
  return uiStream.pipeThrough(
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
        // start/start-step fire before any model tokens — wait for visible content.
        if (
          firstChunk &&
          chunk &&
          typeof chunk === 'object' &&
          (chunk as { type?: string }).type &&
          /^(text-delta|text-start|reasoning-delta|tool-input-start|tool-call)$/.test(
            (chunk as { type: string }).type
          )
        ) {
          firstChunk = false;
          const now = Date.now();
          console.info(
            `[agent] timing session=${params.sessionId} prework_ms=${timing.tPre - timing.t0} model_ttft_ms=${now - timing.tPre} total_ms=${now - timing.t0}`
          );
        }
        controller.enqueue(chunk);
        if (
          chunk &&
          typeof chunk === 'object' &&
          (chunk as { type?: string }).type === 'data-checkpoint'
        ) {
          const id = (chunk as { id?: string }).id;
          if (id) flushedCheckpointIds.add(id);
        }
      },
      flush(controller) {
        if (firstChunk) {
          console.info(
            `[agent] timing session=${params.sessionId} prework_ms=${timing.tPre - timing.t0} model_ttft_ms=none total_ms=${Date.now() - timing.t0}`
          );
        }
        const display = getCheckpointDisplay();
        if (display && !flushedCheckpointIds.has(display.checkpointId)) {
          controller.enqueue({
            type: 'data-checkpoint',
            id: display.checkpointId,
            data: display,
          });
        }
      },
    })
  );
}

/**
 * Always persist UI chunks to the run log. HTTP is optional: client disconnect
 * must not abort streamText (no request AbortSignal; isolate pipe failures).
 */
export async function consumeAgentUiStream(opts: {
  agentRun: Awaited<ReturnType<typeof runAgent>>;
  sessionId: string;
  userId: string;
  origin: RunOrigin;
  response?: ServerResponse;
  runId?: string;
}): Promise<void> {
  const runId = opts.runId ?? (await openRun(opts.sessionId, opts.origin));
  if (!runId) {
    throw new RunInProgressError(opts.sessionId);
  }

  if (opts.response && opts.agentRun.sessionTokenWarning) {
    opts.response.setHeader('x-okvevo-session-token-warning', '1');
    opts.response.setHeader(
      'x-okvevo-estimated-tokens',
      String(opts.agentRun.sessionTokenWarning.estimatedTokens)
    );
  }

  const live = buildLiveUiStream(opts.agentRun, {
    sessionId: opts.sessionId,
    userId: opts.userId,
  });

  let closeStatus: 'complete' | 'error' = 'complete';
  const persistLog = async (stream: ReadableStream<UiChunk>) => {
    let haltTurn = false;
    try {
      haltTurn = await appendCoalesced(opts.sessionId, runId, stream);
    } catch (err) {
      closeStatus = 'error';
      throw err;
    } finally {
      const pending = await closeRun(opts.sessionId, runId, closeStatus);
      void afterCloseRun({
        sessionId: opts.sessionId,
        userId: opts.userId,
        haltTurn,
        closeStatus,
        pending,
        startAgentUiRun,
      });
    }
  };

  if (!opts.response) {
    await persistLog(live as unknown as ReadableStream<UiChunk>);
    return;
  }

  const [httpBranch, logBranch] = live.tee();
  const httpDone = pipeHttpUiStream(opts.response, httpBranch);
  try {
    await persistLog(logBranch as unknown as ReadableStream<UiChunk>);
  } finally {
    await httpDone;
  }
}

export async function pipeAgentStream(
  agentRun: Awaited<ReturnType<typeof runAgent>>,
  response: ServerResponse,
  params: { sessionId: string; userId: string }
) {
  await consumeAgentUiStream({
    agentRun,
    sessionId: params.sessionId,
    userId: params.userId,
    origin: 'chat',
    response,
  });
}

/** Lock the session run before streamText so a second caller 409s without a duplicate model call. */
export async function startAgentUiRun(opts: {
  params: RunAgentParams;
  origin: RunOrigin;
  response?: ServerResponse;
}): Promise<void> {
  const runId = await openRun(opts.params.sessionId, opts.origin);
  if (!runId) {
    throw new RunInProgressError(opts.params.sessionId);
  }
  let handedOff = false;
  try {
    const agentRun = await runAgent(opts.params);
    handedOff = true;
    await consumeAgentUiStream({
      agentRun,
      sessionId: opts.params.sessionId,
      userId: opts.params.userId,
      origin: opts.origin,
      response: opts.response,
      runId,
    });
  } catch (err) {
    if (!handedOff) {
      const pending = await closeRun(opts.params.sessionId, runId, 'error');
      void afterCloseRun({
        sessionId: opts.params.sessionId,
        userId: opts.params.userId,
        haltTurn: false,
        closeStatus: 'error',
        pending,
        startAgentUiRun,
      });
    }
    throw err;
  }
}
