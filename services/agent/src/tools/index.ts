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
  getToolMeta,
  loadSkillManifest,
  newTraceId,
  type SkillDispatchSource,
} from '../catalog/manifest';
import { missingConfirmedFields } from '../checkpoint';
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

export function buildTools(
  ctx: ToolCtx,
  skillId?: string | null,
  source: SkillDispatchSource = 'new-turn'
) {
  const all = {
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

  const manifest = skillId ? loadSkillManifest(skillId) : null;
  const baseNames = manifest?.baseTools ?? BASE_TOOLS;
  const names = new Set<string>(baseNames);
  for (const name of manifest?.tools ?? []) names.add(name);

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
        withConfirmedFields(name, all[name as keyof typeof all], ctx),
      ])
  );
}

/** Ask-Me: block execute when tool-meta lists unset session fields. */
function withConfirmedFields<T extends { execute?: (...args: never[]) => unknown }>(
  name: string,
  t: T,
  ctx: ToolCtx
): T {
  const required = getToolMeta(name)?.requiresConfirmedFields;
  const execute = t.execute;
  if (!required?.length || !execute) return t;
  return {
    ...t,
    // ponytail: wrap in place; ceiling is one extra session read per gated tool call
    execute: async (...args: Parameters<typeof execute>) => {
      if (ctx.pipelineMode === 'ask') {
        const missing = await missingConfirmedFields(ctx.sessionId, required);
        if (missing.length > 0) {
          return {
            error: `Missing confirmed fields for ${name}: ${missing.join(', ')}. Call ask_clarification once per field before retrying.`,
            missingFields: missing,
          };
        }
      }
      return execute(...args);
    },
  };
}
