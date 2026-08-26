import { tool } from 'ai';
import { z } from 'zod';
import { shouldPause } from '../../autonomy';
import { writeAskCheckpoint } from '../../checkpoint';
import { hasSkillManifest, lookupPhase } from '../../catalog/manifest';
import type { ToolCtx } from '../index';
import { askFingerprint, concatenatedChoiceError } from '../../clarifyShape';

export function createClarifyTools(ctx: ToolCtx) {
  return {
    ask_clarification: tool({
      description:
        'Ask the user a clarifying question when required information is missing or ambiguous. In Ask-Me mode, pauses the pipeline until the user answers. In Auto-Run mode, does not pause — apply skill.json defaults or pick only from declared choices. One concern per call — never combine unrelated topics in one choice set. Always declare kind (single_select | phase_gate) and allowFreeform.',
      inputSchema: z.object({
        kind: z
          .enum(['single_select', 'phase_gate'])
          .describe(
            'single_select = numbered choices; phase_gate = Continue only (no choices)'
          ),
        question: z.string().describe('The question to ask the user'),
        context: z
          .string()
          .optional()
          .describe('Optional background explaining why clarification is needed'),
        choices: z
          .array(z.object({ id: z.string(), label: z.string() }))
          .optional()
          .describe('Required non-empty for single_select; omit for phase_gate'),
        allowFreeform: z
          .boolean()
          .describe('Whether the user may type a freeform answer (required)'),
        phase_label: z
          .string()
          .optional()
          .describe('Optional phase title for check-in cards (e.g. "Transcription complete")'),
        bullets: z
          .array(z.string())
          .optional()
          .describe('Optional numbered bullets for the checkpoint card (e.g. card titles)'),
      }),
      execute: async ({ kind, question, context, choices, allowFreeform, phase_label, bullets }) => {
        const shape = concatenatedChoiceError(choices);
        if (shape) {
          console.warn('[clarify] concatenated choice rejected', { sessionId: ctx.sessionId, shape });
          return { error: shape };
        }

        const seen = (ctx.askFingerprints ??= new Set<string>());
        const fp = askFingerprint(question, choices);
        if (seen.has(fp)) {
          return {
            error:
              'This turn already asked an equivalent clarification. Do not repeat the same question or choice set.',
          };
        }

        if (!shouldPause(ctx.pipelineMode)) {
          seen.add(fp);
          return {
            proceed: true,
            instruction:
              "Do not pause or ask the user. Apply this skill's skill.json defaults; if a field has no default, pick only from its declared choices (phases[].choices or styleSeeds).",
          };
        }

        if (kind === 'single_select' && !choices?.length) {
          return {
            error: 'single_select requires a non-empty choices array',
          };
        }
        if (kind === 'phase_gate' && choices?.length) {
          return {
            error: 'phase_gate forbids choices — use single_select instead',
          };
        }

        const found =
          phase_label && ctx.skillName && hasSkillManifest(ctx.skillName)
            ? lookupPhase(ctx.skillName, { completedPhaseLabel: phase_label })
            : null;

        const written =
          kind === 'single_select'
            ? await writeAskCheckpoint(ctx, {
                kind: 'single_select',
                question,
                context,
                choices: choices!,
                allowFreeform,
                phase_label,
                bullets,
                phaseKey: found?.phaseKey,
                completedPhase: found?.phase.completedPhase,
              })
            : await writeAskCheckpoint(ctx, {
                kind: 'phase_gate',
                question,
                context,
                allowFreeform,
                phase_label,
                bullets,
                phaseKey: found?.phaseKey,
                completedPhase: found?.phase.completedPhase,
              });

        seen.add(fp);
        return {
          haltTurn: true,
          checkpointId: written.checkpointId,
          checkpointDisplay: written.checkpointDisplay,
          question,
          context,
        };
      },
    }),
  };
}
