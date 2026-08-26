import { shouldPause } from '../autonomy';
import {
  emitSkillDispatch,
  loadSkillManifest,
  newTraceId,
  type SkillHook,
  type SkillManifest,
} from '../catalog/manifest';
import type { CheckpointDisplayData } from '../checkpoint';
import type { PendingFalJob } from '../pendingFalJob';
import { emitHook, type JobCompletedEvent } from './bus';

export type ResolvedJobHook = {
  skillId: string;
  skillVersion: number;
  manifest: SkillManifest;
  hook: SkillHook;
};

export function resolveJobHook(
  hookName: string,
  job: Pick<PendingFalJob, 'skillId' | 'taskId' | 'requestId'>
): ResolvedJobHook | null {
  if (!job.skillId) {
    throw new Error(
      `pendingFalJob missing skillId stamp (task ${job.taskId}, request ${job.requestId})`
    );
  }
  const manifest = loadSkillManifest(job.skillId);
  const hook = manifest.hooks?.[hookName];
  if (!hook) return null;
  return {
    skillId: job.skillId,
    skillVersion: manifest.version,
    manifest,
    hook,
  };
}

export type HookDispatchResult =
  | {
      status: 'ask_checkpoint';
      checkpointDisplay: CheckpointDisplayData;
      assistantText: string;
      skillId: string;
    }
  | { status: 'continued'; skillId: string }
  | { status: 'queued'; skillId: string }
  | { status: 'delivered' };

/**
 * The JobCompleted handler: resolve the stamped job's manifest hook by event
 * name, then either write the declared ask-phase gate or continue the turn
 * with a system append (never a persisted user row). Missing hook is terminal.
 */
export async function dispatchJobCompleted(
  event: JobCompletedEvent
): Promise<HookDispatchResult> {
  const resolved = resolveJobHook(event.eventName, event.job);
  if (!resolved) return { status: 'delivered' };
  const { skillId, skillVersion, manifest, hook } = resolved;
  const askPhaseKey =
    !event.continueOnly && shouldPause(event.pipelineMode)
      ? hook.askPhaseKey
      : undefined;

  emitSkillDispatch({
    traceId: event.traceId ?? newTraceId(),
    sessionId: event.sessionId,
    taskId: event.job.requestId,
    skillId,
    skillVersion,
    hookName: event.eventName,
    phaseKey: askPhaseKey,
    source: 'job-stamp',
  });

  if (askPhaseKey) {
    const phase = manifest.phases?.[askPhaseKey];
    if (!phase) {
      throw new Error(
        `skill '${skillId}' hook '${event.eventName}' askPhaseKey '${askPhaseKey}' is missing from phases`
      );
    }
    const { writeAskFromPhase } = await import('../checkpoint.js');
    const question = phase.question ?? phase.label;
    const written = await writeAskFromPhase(
      {
        sessionId: event.sessionId,
        userId: event.userId,
        skillName: skillId,
        pipelineMode: event.pipelineMode,
      },
      phase,
      askPhaseKey
    );
    return {
      status: 'ask_checkpoint',
      checkpointDisplay: written.checkpointDisplay,
      assistantText: question,
      skillId,
    };
  }

  const { startAgentUiRun, RunInProgressError } = await import('../agent.js');
  try {
    await startAgentUiRun({
      params: {
        userMessage: 'Continue.',
        persistUser: false,
        extraSystem: hook.continuePrompt,
        forceToolName: hook.forceToolName,
        sessionId: event.sessionId,
        userId: event.userId,
        pipelineMode: event.pipelineMode,
        skillId,
      },
      origin: 'job_completed',
    });
  } catch (err) {
    if (err instanceof RunInProgressError) {
      const { queuePendingJobContinue } = await import('../runLog.js');
      await queuePendingJobContinue(event.sessionId, {
        requestId: event.job.requestId,
        userId: event.userId,
        pipelineMode: event.pipelineMode,
        skillId,
        continuePrompt: hook.continuePrompt,
        ...(hook.forceToolName ? { forceToolName: hook.forceToolName } : {}),
      });
      console.warn('[dispatch] queued JobCompleted continue; run in progress');
      return { status: 'queued', skillId };
    }
    throw err;
  }
  return { status: 'continued', skillId };
}

/** Emit JobCompleted and return the manifest-hook handler's result. */
export async function emitJobCompleted(
  event: JobCompletedEvent
): Promise<HookDispatchResult> {
  const results = await emitHook('JobCompleted', event);
  const result = results.find(
    (r): r is HookDispatchResult =>
      typeof r === 'object' && r !== null && 'status' in r
  );
  if (!result) {
    throw new Error(`no JobCompleted handler for '${event.eventName}'`);
  }
  return result;
}
