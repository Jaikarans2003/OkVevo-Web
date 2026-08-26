import type { CheckpointDisplayData, LoadedCheckpoint } from '../checkpoint';
import type { SkillManifest } from '../catalog/manifest';
import type { PendingFalJob } from '../pendingFalJob';
import type { ResolvedTaggedAsset } from '../taggedAssets';
import type { ToolCtx } from '../tools';

/**
 * The harness lifecycle hook bus: six events, harness-registered handlers,
 * skill direction via manifest data only. Call sites emit; handlers in
 * handlers.ts (registered lazily on first emit) do the work. Handlers run in
 * registration order; a thrown error propagates to the emitter (same as the
 * inline code these replaced).
 */
export type UserPromptSubmitEvent = {
  sessionId: string;
  userId: string;
  /** Raw display text of the user turn. */
  userMessage: string;
  skillId: string | null;
  taggedArtifacts: ResolvedTaggedAsset[];
  /** Full model-bound user content; handlers may reassign/append. */
  userContent: string;
  /** System-prompt appends collected for this turn, in order. */
  systemAppends: string[];
};

export type PreToolUseEvent = {
  toolName: string;
  args: unknown;
  ctx: ToolCtx;
  manifest: SkillManifest | null;
};

/** Handler result to short-circuit a tool call: returned instead of executing. */
export type PreToolUseBlock = { block: unknown };

export type PostToolUseEvent = {
  sessionId: string;
  userId: string;
  skillId: string | null;
  toolCalls: readonly { toolName: string; input: unknown }[];
  toolResults: readonly { toolName: string; output: unknown }[];
  /** Set by the haltTurn capture handler when a tool halted the turn. */
  checkpointDisplay?: CheckpointDisplayData;
};

/** Async job completion; eventName keys the manifest hooks map (transcript_ready, ...). */
export type JobCompletedEvent = {
  eventName: string;
  job: PendingFalJob;
  sessionId: string;
  userId: string;
  pipelineMode: 'ask' | 'auto';
  continueOnly?: boolean;
  traceId?: string;
};

export type RenderCompletedEvent = {
  sessionId: string;
  userId: string;
  skillId: string | null;
  videoUrl: string;
};

export type RenderFailedEvent = {
  sessionId: string;
  userId: string;
  status: 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  error: string;
};

export type CheckpointAnsweredEvent = {
  sessionId: string;
  userId: string;
  pipelineMode: 'ask' | 'auto';
  /** Loaded checkpoint with the fresh answer attached. */
  checkpoint: LoadedCheckpoint;
  skillIdParam?: string;
  sessionSkillId?: string | null;
  /** Resume system-context segments, joined with a blank line by the caller. */
  systemAppends: string[];
  /** Set when the handler wrote a follow-up gate (chained checkpoint). */
  checkpointDisplay?: CheckpointDisplayData;
  /** Set when the turn must stop after the current step (chained gate). */
  haltAfterFirstStep?: boolean;
};

export type HookPayloads = {
  UserPromptSubmit: UserPromptSubmitEvent;
  PreToolUse: PreToolUseEvent;
  PostToolUse: PostToolUseEvent;
  JobCompleted: JobCompletedEvent;
  RenderCompleted: RenderCompletedEvent;
  RenderFailed: RenderFailedEvent;
  CheckpointAnswered: CheckpointAnsweredEvent;
};

export type HookEventName = keyof HookPayloads;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (event: any) => unknown;

const registry = new Map<HookEventName, AnyHandler[]>();

export function onHook<K extends HookEventName>(
  name: K,
  handler: (event: HookPayloads[K]) => unknown
): void {
  const list = registry.get(name) ?? [];
  list.push(handler as AnyHandler);
  registry.set(name, list);
}

let handlersLoaded = false;
function ensureHandlers(): void {
  if (handlersLoaded) return;
  handlersLoaded = true;
  // Lazy so emit works from any entrypoint (server, selfchecks) without an
  // explicit register call, and so handlers.ts's wide import graph never
  // participates in a static cycle with its emitters.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./handlers');
}

/** Run all handlers in registration order; returns their results. */
export async function emitHook<K extends HookEventName>(
  name: K,
  event: HookPayloads[K]
): Promise<unknown[]> {
  ensureHandlers();
  const results: unknown[] = [];
  for (const handler of registry.get(name) ?? []) {
    results.push(await handler(event));
  }
  return results;
}

/** Blockable PreToolUse emit: first block wins, later handlers do not run. */
export async function emitPreToolUse(
  event: PreToolUseEvent
): Promise<{ blocked: true; output: unknown } | { blocked: false }> {
  ensureHandlers();
  for (const handler of registry.get('PreToolUse') ?? []) {
    const result = await handler(event);
    if (result && typeof result === 'object' && 'block' in result) {
      return { blocked: true, output: (result as PreToolUseBlock).block };
    }
  }
  return { blocked: false };
}
