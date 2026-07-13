import { tool } from 'ai';
import { z } from 'zod';

export function createClarifyTools(_ctx: { sessionId: string; userId: string }) {
  return {
    ask_clarification: tool({
      description:
        'Ask the user a clarifying question when required information is missing or ambiguous. Returns formatted text for you to relay — does not block or wait for a response.',
      inputSchema: z.object({
        question: z.string().describe('The question to ask the user'),
        context: z
          .string()
          .optional()
          .describe('Optional background explaining why clarification is needed'),
      }),
      execute: async ({ question, context }) => {
        return context ? `${context}\n\n${question}` : question;
      },
    }),
  };
}
