// @ts-nocheck
import { tool } from 'ai';
import { z } from 'zod';
import { buildFalWebhookUrl, falQueueSubmit } from '../../falQueue';

/** Hard guardrail — never request longer than this from Wan. */
export const MAX_BACKGROUND_VIDEO_SECONDS = 15;

const WAN_MODEL = 'fal-ai/wan-t2v';
const MIN_FRAMES = 81;
const MAX_FRAMES = 100;
const MIN_FPS = 5;
const MAX_FPS = 24;

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

/**
 * Map a requested duration into Wan 2.1 frame/fps limits.
 * Duration is hard-clamped to [4, MAX_BACKGROUND_VIDEO_SECONDS].
 */
export function resolveWanTiming(durationSeconds: number): {
  num_frames: number;
  frames_per_second: number;
  requested_seconds: number;
  actual_seconds: number;
  clamped: boolean;
} {
  const raw = Number.isFinite(durationSeconds) ? durationSeconds : 5;
  const requested = Math.round(raw);
  const clampedValue = Math.min(
    MAX_BACKGROUND_VIDEO_SECONDS,
    Math.max(4, requested)
  );
  const clamped = clampedValue !== requested;

  for (let fps = 16; fps >= MIN_FPS; fps--) {
    const frames = Math.round(clampedValue * fps);
    if (frames >= MIN_FRAMES && frames <= MAX_FRAMES) {
      return {
        num_frames: frames,
        frames_per_second: fps,
        requested_seconds: requested,
        actual_seconds: frames / fps,
        clamped,
      };
    }
  }

  // Prefer longer clips at lower fps when exact match fails.
  if (clampedValue >= 12) {
    return {
      num_frames: 90,
      frames_per_second: 6,
      requested_seconds: requested,
      actual_seconds: 15,
      clamped: true,
    };
  }

  return {
    num_frames: MIN_FRAMES,
    frames_per_second: 16,
    requested_seconds: requested,
    actual_seconds: MIN_FRAMES / 16,
    clamped,
  };
}

export function createVideoGenerateTools(ctx: {
  sessionId: string;
  userId: string;
}) {
  return {
    video_generate: tool({
      description: `Queue a short backdrop video via Fal Wan 2.1 (fal-ai/wan-t2v). Hard-capped at ${MAX_BACKGROUND_VIDEO_SECONDS} seconds. Returns immediately with request_id (status queued). The video appears in chat/Deliverables via webhook when ready — never invent or paste a URL.`,
      inputSchema: z.object({
        prompt: z
          .string()
          .min(1)
          .describe('Scene description for the background video'),
        duration_seconds: z
          .number()
          .optional()
          .describe(
            `Desired length in seconds (4–${MAX_BACKGROUND_VIDEO_SECONDS}). Longer requests are clamped.`
          ),
        resolution: z
          .enum(['480p', '580p', '720p'])
          .optional()
          .describe('Output resolution; default 720p'),
        aspect_ratio: z
          .enum(['16:9', '9:16'])
          .optional()
          .describe('Aspect ratio; default 16:9'),
      }),
      execute: async ({
        prompt,
        duration_seconds = 5,
        resolution = '720p',
        aspect_ratio = '16:9',
      }) => {
        try {
          const falKey = resolveFalVideoKey();
          const timing = resolveWanTiming(duration_seconds);
          const webhookUrl = buildFalWebhookUrl(ctx.sessionId, 'fal_video');
          const { request_id } = await falQueueSubmit({
            model: WAN_MODEL,
            falKey,
            webhookUrl,
            input: {
              prompt,
              num_frames: timing.num_frames,
              frames_per_second: timing.frames_per_second,
              resolution,
              aspect_ratio,
              enable_safety_checker: true,
              turbo_mode: true,
            },
          });

          return {
            request_id,
            status: 'queued',
            prompt_used: prompt,
            resolution,
            aspect_ratio,
            model: WAN_MODEL,
            requested_seconds: timing.requested_seconds,
            duration_seconds: timing.actual_seconds,
            duration_clamped: timing.clamped,
            max_seconds: MAX_BACKGROUND_VIDEO_SECONDS,
            num_frames: timing.num_frames,
            frames_per_second: timing.frames_per_second,
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
