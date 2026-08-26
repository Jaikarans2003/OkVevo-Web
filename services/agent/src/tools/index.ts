import { createFilesystemTools } from './general/filesystem';
import { createWebTools } from './general/web';
import { createVisionTools } from './general/vision';
import { createClarifyTools } from './general/clarify';
import { createImageGenerateTools } from './general/image_generate';
import { createVideoGenerateTools } from './general/video_generate';
import { createConceptsTools } from './pipeline/concepts';
import { createHyperframesTools } from './pipeline/hyperframes';
import { createManimTools } from './pipeline/manim';
import { createTalkingHeadTools } from './pipeline/talkingHead';
import { createTranscribeTools } from './pipeline/transcribe';
import {
  BASE_TOOLS,
  emitSkillDispatch,
  loadSkillManifest,
  newTraceId,
  type SkillDispatchSource,
  type SkillManifest,
} from '../catalog/manifest';
import { parseToolMatcher } from '../permissions';
import { emitPreToolUse } from '../hooks/bus';
import type { ResolvedTaggedAsset } from '../taggedAssets';

export { getSessionWorkdir, execCommand } from './lib/utils';
export {
  buildDeterministicSegments,
  resolveNonOverlappingConcepts,
  segmentsCoverTimeline,
  segmentsHaveRequiredModes,
  validatePlannedSegments,
} from '../skills/eduVideo/planning';

export type ToolCtx = {
  sessionId: string;
  userId: string;
  pipelineMode: 'ask' | 'auto';
  skillName: string;
  taggedArtifacts: ResolvedTaggedAsset[];
  /** Speaker URLs from restore_generation this turn — merged into scaffold allowlist. */
  restoreAllowlistUrls: string[];
  /** Per-turn ask_clarification fingerprints (same concern / choice ids). */
  askFingerprints?: Set<string>;
};

const PROBE_CTX: ToolCtx = {
  sessionId: '',
  userId: '',
  pipelineMode: 'auto',
  skillName: '',
  taggedArtifacts: [],
  restoreAllowlistUrls: [],
};

/** Single factory: every registered tool. Adding a tool means adding it here. */
export function assembleAllTools(ctx: ToolCtx) {
  return {
    ...createFilesystemTools(ctx),
    ...createWebTools(ctx),
    ...createVisionTools(ctx),
    ...createClarifyTools(ctx),
    ...createTranscribeTools(ctx),
    ...createConceptsTools(ctx),
    ...createManimTools(ctx),
    ...createHyperframesTools(ctx),
    ...createTalkingHeadTools(ctx),
    ...createImageGenerateTools(ctx),
    ...createVideoGenerateTools(ctx),
  };
}

export const SAFE_TOOL_UNIVERSE: readonly string[] = Object.freeze(
  Object.keys(assembleAllTools(PROBE_CTX))
);

export function buildTools(
  ctx: ToolCtx,
  skillId?: string | null,
  source: SkillDispatchSource = 'new-turn'
) {
  const all = assembleAllTools(ctx);

  const manifest = skillId ? loadSkillManifest(skillId) : null;
  const baseNames = manifest?.baseTools ?? BASE_TOOLS;
  const names = new Set<string>(baseNames);
  for (const name of manifest?.tools ?? []) names.add(name);
  // permissions.deny on a bare tool name removes visibility entirely;
  // argument matchers are enforced at execute time by the gate below.
  for (const rule of manifest?.permissions?.deny ?? []) {
    const matcher = parseToolMatcher(rule);
    if (matcher.commandExact === undefined && matcher.commandPrefix === undefined) {
      names.delete(matcher.tool);
    }
  }

  emitSkillDispatch({
    traceId: newTraceId(),
    sessionId: ctx.sessionId,
    skillId: skillId ?? '',
    skillVersion: manifest?.version ?? 1,
    source,
  });

  return Object.fromEntries(
    [...names]
      .filter((name) => name in all)
      .map((name) => [
        name,
        withPreToolUse(name, all[name as keyof typeof all], ctx, manifest),
      ])
  );
}

/**
 * The single PreToolUse gate: every tool execute flows through the hook bus;
 * handlers (permissions, confirmedFields — hooks/handlers.ts) may return a
 * block output instead of executing.
 */
function withPreToolUse<T extends { execute?: (...args: never[]) => unknown }>(
  name: string,
  t: T,
  ctx: ToolCtx,
  manifest: SkillManifest | null
): T {
  const execute = t.execute;
  if (!execute) return t;
  return {
    ...t,
    execute: async (...args: Parameters<typeof execute>) => {
      const gate = await emitPreToolUse({ toolName: name, args: args[0], ctx, manifest });
      if (gate.blocked) return gate.output;
      return execute(...args);
    },
  };
}
