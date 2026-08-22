import {
  emitSkillDispatch,
  loadSkillManifest,
  newTraceId,
  type SkillHook,
  type SkillHookName,
  type SkillManifest,
} from '../catalog/manifest';
import type { CheckpointDisplayData } from '../checkpoint';
import type { PendingFalJob } from '../pendingFalJob';

export type ResolvedJobHook = {
  skillId: string;
  skillVersion: number;
  manifest: SkillManifest;
  hook: SkillHook;
};

export function resolveJobHook(
  hookName: SkillHookName,
  job: Pick<PendingFalJob, 'skillId' | 'taskId' | 'requestId'>
): ResolvedJobHook {
  if (!job.skillId) {
    throw new Error(
      `pendingFalJob missing skillId stamp (task ${job.taskId}, request ${job.requestId})`
    );
  }
  const manifest = loadSkillManifest(job.skillId);
  const hook = manifest.hooks?.[hookName];
  if (!hook) {
    throw new Error(`skill '${job.skillId}' has no hook '${hookName}'`);
  }
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
  | { status: 'continued'; skillId: string };

export async function dispatchHook(
  hookName: SkillHookName,
  opts: {
    job: PendingFalJob;
    sessionId: string;
    userId: string;
    pipelineMode: 'ask' | 'auto';
    continueOnly?: boolean;
    traceId?: string;
  }
): Promise<HookDispatchResult> {
  const resolved = resolveJobHook(hookName, opts.job);
  const { skillId, skillVersion, manifest, hook } = resolved;
  const askPhaseKey =
    !opts.continueOnly && opts.pipelineMode === 'ask' ? hook.askPhaseKey : undefined;

  emitSkillDispatch({
    traceId: opts.traceId ?? newTraceId(),
    sessionId: opts.sessionId,
    taskId: opts.job.requestId,
    skillId,
    skillVersion,
    hookName,
    phaseKey: askPhaseKey,
    source: 'job-stamp',
  });

  if (askPhaseKey) {
    const phase = manifest.phases?.[askPhaseKey];
    if (!phase) {
      throw new Error(
        `skill '${skillId}' hook '${hookName}' askPhaseKey '${askPhaseKey}' is missing from phases`
      );
    }
    const { writeAskCheckpoint } = await import('../checkpoint.js');
    const question = phase.question ?? phase.label;
    const written = await writeAskCheckpoint(
      {
        sessionId: opts.sessionId,
        userId: opts.userId,
        skillName: skillId,
        pipelineMode: opts.pipelineMode,
      },
      {
        kind: 'phase_gate',
        question,
        allowFreeform: phase.allowFreeform ?? false,
        phase_label: phase.label,
        completedPhase: phase.completedPhase,
        phaseKey: askPhaseKey,
      }
    );
    return {
      status: 'ask_checkpoint',
      checkpointDisplay: written.checkpointDisplay,
      assistantText: question,
      skillId,
    };
  }

  const { runAgent } = await import('../agent.js');
  const result = await runAgent({
    userMessage: hook.continuePrompt,
    sessionId: opts.sessionId,
    userId: opts.userId,
    pipelineMode: opts.pipelineMode,
    skillId,
  });
  await result.result.text;
  return { status: 'continued', skillId };
}
