// @ts-nocheck
import { createFilesystemTools } from './general/filesystem';
import { createWebTools } from './general/web';
import { createVisionTools } from './general/vision';
import { createConceptsTools } from './edu-video/concepts';
import { createHyperframesTools } from './edu-video/hyperframes';
import { createManimTools } from './edu-video/manim';
import { createTranscribeTools } from './edu-video/transcribe';

export { getSessionWorkdir, execCommand } from './lib/utils';
export {
  buildDeterministicSegments,
  resolveNonOverlappingConcepts,
  segmentsCoverTimeline,
  segmentsHaveRequiredModes,
} from '../skills/eduVideo/planning';

export function createTools(ctx: { sessionId: string; userId: string }) {
  return {
    ...createFilesystemTools(ctx),
    ...createWebTools(ctx),
    ...createVisionTools(ctx),
    ...createTranscribeTools(ctx),
    ...createConceptsTools(ctx),
    ...createManimTools(ctx),
    ...createHyperframesTools(ctx),
  };
}
