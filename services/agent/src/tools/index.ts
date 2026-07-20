import { createFilesystemTools } from './general/filesystem';
import { createWebTools } from './general/web';
import { createVisionTools } from './general/vision';
import { createClarifyTools } from './general/clarify';
import { createConceptsTools } from './pipeline/concepts';
import { createHyperframesTools } from './pipeline/hyperframes';
import { createManimTools } from './pipeline/manim';
import { createTranscribeTools } from './pipeline/transcribe';
import { BASE_TOOLS, SKILL_TOOLS } from './catalog';

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
};

export function buildTools(ctx: ToolCtx, opts?: { skill?: string | null }) {
  const all = {
    ...createFilesystemTools(ctx),
    ...createWebTools(ctx),
    ...createVisionTools(ctx),
    ...createClarifyTools(ctx),
    ...createTranscribeTools(ctx),
    ...createConceptsTools(ctx),
    ...createManimTools(ctx),
    ...createHyperframesTools(ctx),
  };

  const names = new Set<string>(BASE_TOOLS);
  const skill = opts?.skill;
  if (skill && SKILL_TOOLS[skill]) {
    for (const name of SKILL_TOOLS[skill]) {
      names.add(name);
    }
  }

  return Object.fromEntries(
    [...names].filter((name) => name in all).map((name) => [name, all[name as keyof typeof all]])
  );
}
