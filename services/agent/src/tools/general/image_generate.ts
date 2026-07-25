// @ts-nocheck
import { tool } from 'ai';
import { z } from 'zod';
import { buildFalWebhookUrl, falQueueSubmit } from '../../falQueue';
import {
  IMAGE_MODEL_KEYS,
  buildImageInput,
  type ImageModelKey,
} from './mediaModelRegistry';

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
      description: `Queue a background image via a Fal media model (closed model enum). Returns immediately with request_id (status queued). The image appears in chat/Deliverables via webhook when ready — never invent or paste a URL.`,
      inputSchema: z.object({
        prompt: z
          .string()
          .min(1)
          .describe('Scene description for the background image'),
        model: z
          .enum(IMAGE_MODEL_KEYS)
          .describe(
            'Registry key: studio_background | nano_banana_2 | nano_banana_2_lite | nano_banana_pro | gpt_image_2'
          ),
        aspect_ratio: z
          .string()
          .optional()
          .describe(
            'Unified ratio (e.g. 16:9, 9:16, 1:1). Mapped to Fal image_size or aspect_ratio per model.'
          ),
        resolution: z
          .string()
          .optional()
          .describe(
            'Model-specific resolution when supported (e.g. 1K). Omitted for models without it.'
          ),
      }),
      execute: async ({ prompt, model, aspect_ratio, resolution }) => {
        try {
          const falKey = resolveFalImageKey();
          const { falModel, input } = buildImageInput(model as ImageModelKey, {
            prompt,
            aspect_ratio,
            resolution,
          });
          const webhookUrl = buildFalWebhookUrl(ctx.sessionId, 'fal_image');
          const { request_id } = await falQueueSubmit({
            model: falModel,
            falKey,
            webhookUrl,
            input,
          });

          return {
            request_id,
            status: 'queued',
            prompt_used: prompt,
            model,
            fal_model: falModel,
            aspect_ratio: aspect_ratio ?? null,
            resolution: resolution ?? null,
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
