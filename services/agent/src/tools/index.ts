import { createFilesystemTools } from './general/filesystem';
import { createWebTools } from './general/web';
import { createVisionTools } from './general/vision';
import { createClarifyTools } from './general/clarify';
import { createImageGenerateTools } from './general/image_generate';
import { createVideoGenerateTools } from './general/video_generate';
import { createConceptsTools } from './pipeline/concepts';
import { createHyperframesTools } from './pipeline/hyperframes';
import { createManimTools } from './pipeline/manim';
import { createTranscribeTools } from './pipeline/transcribe';
import { BASE_TOOLS, SKILL_BASE_OVERRIDES, SKILL_TOOLS } from './catalog';
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
};

export function buildTools(ctx: ToolCtx, skills: Iterable<string> = []) {
  const all = {
    ...createFilesystemTools(ctx),
    ...createWebTools(ctx),
    ...createVisionTools(ctx),
    ...createClarifyTools(ctx),
    ...createTranscribeTools(ctx),
    ...createConceptsTools(ctx),
    ...createManimTools(ctx),
    ...createHyperframesTools(ctx),
    ...createImageGenerateTools(ctx),
    ...createVideoGenerateTools(ctx),
  };

  const skillList = [...skills];
  const baseNames =
    skillList.length === 1 && SKILL_BASE_OVERRIDES[skillList[0]]
      ? SKILL_BASE_OVERRIDES[skillList[0]]
      : BASE_TOOLS;

  const names = new Set<string>(baseNames);
  for (const skill of skillList) {
    if (!SKILL_TOOLS[skill]) continue;
    for (const name of SKILL_TOOLS[skill]) {
      names.add(name);
    }
  }

  return Object.fromEntries(
    [...names].filter((name) => name in all).map((name) => [name, all[name as keyof typeof all]])
  );
}
