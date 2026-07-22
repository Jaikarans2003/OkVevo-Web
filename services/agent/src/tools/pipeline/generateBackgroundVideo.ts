// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import { downloadFile, getSessionWorkdir } from '../lib/utils';
import { getTempPath, uploadToStorage, writeAssetUrl } from '../../storage';

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

async function falQueueGenerate(
  falKey: string,
  input: Record<string, unknown>
): Promise<{ video?: { url?: string }; seed?: number }> {
  const submit = await fetch(`https://queue.fal.run/${WAN_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!submit.ok) {
    const text = await submit.text();
    throw new Error(`Fal queue submit ${submit.status}: ${text.slice(0, 500)}`);
  }

  const submitted = (await submit.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  };

  const requestId = submitted.request_id;
  if (!requestId) {
    throw new Error('Fal queue submit returned no request_id');
  }

  const statusUrl =
    submitted.status_url ??
    `https://queue.fal.run/${WAN_MODEL}/requests/${requestId}/status`;
  const resultUrl =
    submitted.response_url ??
    `https://queue.fal.run/${WAN_MODEL}/requests/${requestId}`;

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });
    if (!statusRes.ok) {
      const text = await statusRes.text();
      throw new Error(
        `Fal queue status ${statusRes.status}: ${text.slice(0, 500)}`
      );
    }

    const statusBody = (await statusRes.json()) as {
      status?: string;
      error?: string;
    };
    const status = (statusBody.status ?? '').toUpperCase();

    if (status === 'COMPLETED' || status === 'OK') {
      break;
    }
    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
      throw new Error(
        `Fal video generation failed: ${statusBody.error || status}`
      );
    }
  }

  const resultRes = await fetch(resultUrl, {
    headers: { Authorization: `Key ${falKey}` },
  });
  if (!resultRes.ok) {
    const text = await resultRes.text();
    throw new Error(
      `Fal queue result ${resultRes.status}: ${text.slice(0, 500)}`
    );
  }

  return (await resultRes.json()) as {
    video?: { url?: string };
    seed?: number;
  };
}

export function createGenerateBackgroundVideoTools(ctx: {
  sessionId: string;
  userId: string;
}) {
  return {
    generate_background_video: tool({
      description: `Generate a short backdrop video from a text prompt using Fal Wan 2.1 (fal-ai/wan-t2v). Hard-capped at ${MAX_BACKGROUND_VIDEO_SECONDS} seconds. Uploads the MP4 to Firebase Storage and returns the public URL. Use for moving video backgrounds behind a subject.`,
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

          const data = await falQueueGenerate(falKey, {
            prompt,
            num_frames: timing.num_frames,
            frames_per_second: timing.frames_per_second,
            resolution,
            aspect_ratio,
            enable_safety_checker: true,
            turbo_mode: true,
          });

          const falVideoUrl = data.video?.url;
          if (!falVideoUrl) {
            throw new Error('Fal returned no video URL');
          }

          const workdir = getSessionWorkdir(ctx.sessionId);
          const localPath = path.join(workdir, 'generated_background.mp4');
          await downloadFile(falVideoUrl, localPath);

          const tempPath = getTempPath(`${ctx.sessionId}_bg_video.mp4`);
          fs.copyFileSync(localPath, tempPath);

          const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/background.mp4`;
          const videoUrl = await uploadToStorage(tempPath, storagePath);
          await writeAssetUrl(
            ctx.userId,
            ctx.sessionId,
            'background_video',
            videoUrl
          );

          return {
            video_url: videoUrl,
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
            fal_source_url: falVideoUrl,
            seed: data.seed ?? null,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[generate_background_video]', ctx.sessionId, message);
          throw new Error(`Background video generation failed: ${message}`);
        }
      },
    }),
  };
}
