import { createFilesystemTools } from './general/filesystem';
import { createWebTools } from './general/web';
import { createVisionTools } from './general/vision';
import { createClarifyTools } from './general/clarify';
import { createConceptsTools } from './pipeline/concepts';
import { createHyperframesTools } from './pipeline/hyperframes';
import { createManimTools } from './pipeline/manim';
import { createTranscribeTools } from './pipeline/transcribe';
import { createRemoveBackgroundTools } from './pipeline/removeBackground';
import { createGenerateBackgroundTools } from './pipeline/generateBackground';
import { createGenerateBackgroundVideoTools } from './pipeline/generateBackgroundVideo';
import { createCompositeSubjectTools } from './pipeline/compositeSubject';
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
    ...createRemoveBackgroundTools(ctx),
    ...createGenerateBackgroundTools(ctx),
    ...createGenerateBackgroundVideoTools(ctx),
    ...createCompositeSubjectTools(ctx),
  };

  const skill = opts?.skill;
  const baseNames =
    skill && SKILL_BASE_OVERRIDES[skill]
      ? SKILL_BASE_OVERRIDES[skill]
      : BASE_TOOLS;
  const names = new Set<string>(baseNames);
  if (skill && SKILL_TOOLS[skill]) {
    for (const name of SKILL_TOOLS[skill]) {
      names.add(name);
    }
  }

  return Object.fromEntries(
    [...names].filter((name) => name in all).map((name) => [name, all[name as keyof typeof all]])
  );
}
