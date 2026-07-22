// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import { downloadFile, getSessionWorkdir } from '../lib/utils';
import { getTempPath, uploadToStorage, writeAssetUrl } from '../../storage';

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

export function createGenerateBackgroundTools(ctx: {
  sessionId: string;
  userId: string;
}) {
  return {
    generate_background: tool({
      description: `Generate a background image from a text prompt using Fal AI FLUX schnell. Uploads the image to Firebase Storage and returns the public URL. Use for video backdrops and compositing behind transparent subjects.`,
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
          const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
            method: 'POST',
            headers: {
              Authorization: `Key ${falKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt,
              image_size,
              num_images: 1,
              output_format: 'png',
              enable_safety_checker: true,
            }),
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(
              `Fal API error ${response.status}: ${text.slice(0, 500)}`
            );
          }

          const data = (await response.json()) as {
            images?: {
              url?: string;
              width?: number;
              height?: number;
              content_type?: string;
            }[];
            seed?: number;
          };

          const image = data.images?.[0];
          if (!image?.url) {
            throw new Error('Fal returned no image URL');
          }

          const workdir = getSessionWorkdir(ctx.sessionId);
          const localPath = path.join(workdir, 'generated_background.png');
          await downloadFile(image.url, localPath);

          const tempPath = getTempPath(`${ctx.sessionId}_bg.png`);
          fs.copyFileSync(localPath, tempPath);

          const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/background.png`;
          const imageUrl = await uploadToStorage(tempPath, storagePath);
          await writeAssetUrl(
            ctx.userId,
            ctx.sessionId,
            'background_image',
            imageUrl
          );

          return {
            image_url: imageUrl,
            prompt_used: prompt,
            image_size,
            width: image.width ?? null,
            height: image.height ?? null,
            fal_source_url: image.url,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[generate_background]', ctx.sessionId, message);
          throw new Error(`Background generation failed: ${message}`);
        }
      },
    }),
  };
}
