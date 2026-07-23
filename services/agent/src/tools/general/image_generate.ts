// @ts-nocheck
import { tool } from 'ai';
import { z } from 'zod';
import { buildFalWebhookUrl, falQueueSubmit } from '../../falQueue';

const IMAGE_MODEL = 'fal-ai/flux/schnell';

const IMAGE_SIZES = [
  'square_hd',
  'square',
  'portrait_4_3',
  'portrait_16_9',
  'landscape_4_3',
  'landscape_16_9',
] as const;

function resolveFalImageKey(): string {
  const key =
    process.env.FAL_API_IMAGE?.trim() || process.env.FAL_API_KEY?.trim();
  if (!key) {
    throw new Error('Missing FAL_API_IMAGE (or FAL_API_KEY)');
  }
  return key;
}

export function createImageGenerateTools(ctx: {
  sessionId: string;
  userId: string;
}) {
  return {
    image_generate: tool({
      description: `Queue a background image generation via Fal AI FLUX schnell. Returns immediately with request_id (status queued). The image appears in chat/Deliverables via webhook when ready — never invent or paste a URL.`,
      inputSchema: z.object({
        prompt: z
          .string()
          .min(1)
          .describe('Scene description for the background image'),
        image_size: z
          .enum(IMAGE_SIZES)
          .optional()
          .describe('Output size preset; default landscape_16_9'),
      }),
      execute: async ({ prompt, image_size = 'landscape_16_9' }) => {
        try {
          const falKey = resolveFalImageKey();
          const webhookUrl = buildFalWebhookUrl(ctx.sessionId, 'fal_image');
          const { request_id } = await falQueueSubmit({
            model: IMAGE_MODEL,
            falKey,
            webhookUrl,
            input: {
              prompt,
              image_size,
              num_images: 1,
              output_format: 'png',
              enable_safety_checker: true,
            },
          });

          return {
            request_id,
            status: 'queued',
            prompt_used: prompt,
            image_size,
            model: IMAGE_MODEL,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[image_generate]', ctx.sessionId, message);
          throw new Error(`Background generation failed: ${message}`);
        }
      },
    }),
  };
}
