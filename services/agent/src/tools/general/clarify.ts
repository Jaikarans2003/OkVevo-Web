import { tool } from 'ai';
import { z } from 'zod';
import { writeAskCheckpoint } from '../../checkpoint';
import type { ToolCtx } from '../index';

export function createClarifyTools(ctx: ToolCtx) {
  return {
    ask_clarification: tool({
      description:
        'Ask the user a clarifying question when required information is missing or ambiguous. In Ask-Me mode, pauses the pipeline until the user answers. In Auto-Run mode, returns formatted text for you to relay.',
      inputSchema: z.object({
        question: z.string().describe('The question to ask the user'),
        context: z
          .string()
          .optional()
          .describe('Optional background explaining why clarification is needed'),
        choices: z
          .array(z.object({ id: z.string(), label: z.string() }))
          .optional()
          .describe('Optional multiple-choice answers'),
        allowFreeform: z
          .boolean()
          .optional()
          .describe('Whether the user may type a freeform answer (default true)'),
        phase_label: z
          .string()
          .optional()
          .describe('Optional phase title for check-in cards (e.g. "Transcription complete")'),
      }),
      execute: async ({ question, context, choices, allowFreeform, phase_label }) => {
        if (ctx.pipelineMode !== 'ask') {
          return context ? `${context}\n\n${question}` : question;
        }

        const written = await writeAskCheckpoint(ctx, {
          question,
          context,
          choices,
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
