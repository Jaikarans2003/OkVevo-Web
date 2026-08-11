import { tool } from 'ai';
import { z } from 'zod';
import { matchToolOwnedDecision, writeAskCheckpoint } from '../../checkpoint';
import type { ToolCtx } from '../index';

export function createClarifyTools(ctx: ToolCtx) {
  return {
    ask_clarification: tool({
      description:
        'Ask the user a clarifying question when required information is missing or ambiguous. In Ask-Me mode, pauses the pipeline until the user answers. In Auto-Run mode, returns formatted text for you to relay. Do NOT use for transcription language, orientation, brand colors, or animation style — those are front-loaded or tool-owned. Always declare kind (single_select | phase_gate) and allowFreeform.',
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
      }),
      execute: async ({ kind, question, context, choices, allowFreeform, phase_label }) => {
        const owned = matchToolOwnedDecision(choices);
        // Allow legacy phase-labeled gates; block freelanced duplicates.
        const allowedPhase =
          phase_label === 'Video orientation' ||
          phase_label === 'Transcription language';
        if (owned && !allowedPhase) {
          return {
            error: `Decision "${owned}" is tool-owned / front-loaded. Do not ask_clarification for it — use the pipeline tool or wait for the Video preferences batch.`,
            decision: owned,
          };
        }

        if (ctx.pipelineMode !== 'ask') {
          return context ? `${context}\n\n${question}` : question;
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

        const written =
          kind === 'single_select'
            ? await writeAskCheckpoint(ctx, {
                kind: 'single_select',
                question,
                context,
                choices: choices!,
                allowFreeform,
                phase_label,
              })
            : await writeAskCheckpoint(ctx, {
                kind: 'phase_gate',
                question,
                context,
                allowFreeform,
                phase_label,
              });

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
