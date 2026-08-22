// @ts-nocheck
import { tool } from 'ai';
import { z } from 'zod';
import { buildFalWebhookUrl, falQueueSubmit } from '../../falQueue';
import { persistPendingFalJob } from '../../pendingFalJob';
import {
  VIDEO_DURATIONS,
  VIDEO_MODEL_KEYS,
  buildVideoInput,
  type VideoModelKey,
} from './mediaModelRegistry';

function resolveFalVideoKey(): string {
  const key =
    process.env.FAL_API_VIDEO?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    process.env.FAL_API_IMAGE?.trim();
  if (!key) {
    throw new Error('Missing FAL_API_VIDEO (or FAL_API_KEY / FAL_API_IMAGE)');
  }
  return key;
}

export function createVideoGenerateTools(ctx: {
  sessionId: string;
  userId: string;
  skillName?: string;
}) {
  return {
    video_generate: tool({
      description: `Queue a short backdrop video via Seedance 2.0 (closed model enum). Returns immediately with request_id (status queued). The video appears in chat/Deliverables via webhook when ready — never invent or paste a URL. Pass reference_image_url to use image-to-video.`,
      inputSchema: z.object({
        prompt: z
          .string()
          .min(1)
          .describe('Scene description for the background video'),
        model: z
          .enum(VIDEO_MODEL_KEYS)
          .default('seedance_2_fast')
          .describe('Registry key: seedance_2 | seedance_2_fast'),
        aspect_ratio: z
          .enum(['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'])
          .optional()
          .describe('Aspect ratio; default 16:9'),
        duration: z
          .enum(VIDEO_DURATIONS)
          .optional()
          .describe('Clip length as string enum auto|4…15; default 5'),
        resolution: z
          .enum(['480p', '720p'])
          .optional()
          .describe('Output resolution; default 720p (Seedance ceiling)'),
        reference_image_url: z
          .string()
          .url()
          .optional()
          .describe(
            'Optional still URL for image-to-video; switches to the I2V Fal endpoint'
          ),
      }),
      execute: async ({
        prompt,
        model = 'seedance_2_fast',
        aspect_ratio,
        duration,
        resolution,
        reference_image_url,
      }) => {
        try {
          const falKey = resolveFalVideoKey();
          const { falModel, input } = buildVideoInput(model as VideoModelKey, {
            prompt,
            aspect_ratio,
            duration,
            resolution,
            reference_image_url,
          });
          const webhookUrl = buildFalWebhookUrl(ctx.sessionId, 'fal_video');
          const { request_id } = await falQueueSubmit({
            model: falModel,
            falKey,
            webhookUrl,
            input,
          });
          await persistPendingFalJob(ctx.sessionId, {
            taskId: 'fal_video',
            requestId: request_id,
            resumeOnCompletion: false,
            ...(ctx.skillName ? { skillId: ctx.skillName } : {}),
          });

          return {
            request_id,
            status: 'queued',
            prompt_used: prompt,
            model,
            fal_model: falModel,
            aspect_ratio: (input.aspect_ratio as string) ?? null,
            duration: (input.duration as string) ?? null,
            resolution: (input.resolution as string) ?? null,
            i2v: Boolean(reference_image_url),
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[video_generate]', ctx.sessionId, message);
          throw new Error(`Background video generation failed: ${message}`);
        }
      },
    }),
  };
}
