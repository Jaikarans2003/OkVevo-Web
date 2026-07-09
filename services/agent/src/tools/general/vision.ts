// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import { downloadFile } from '../lib/utils';

const VISION_MODEL = process.env.VISION_MODEL ?? 'google/gemini-2.5-flash';

async function callOpenRouterVision(
  imageBase64: string,
  mimeType: string,
  question: string
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: question,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter vision error ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned empty vision response');
  }

  return content;
}

function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return map[ext] ?? 'image/jpeg';
}

export function createVisionTools(ctx: { sessionId: string; userId: string }) {
  return {
    vision_analyze: tool({
      description: `Analyze an image from a URL. Downloads the image, sends it to a
vision model, and returns a detailed analysis. Use this to describe images,
read text from screenshots, inspect thumbnails, or answer any visual question.`,
      inputSchema: z.object({
        image_url: z
          .string()
          .describe('HTTP/HTTPS URL of the image to analyze'),
        question: z
          .string()
          .describe('What you want to know about the image. Be specific.'),
      }),
      execute: async ({ image_url, question }) => {
        const ext = path.extname(new URL(image_url).pathname) || '.jpg';
        const tempPath = path.join(
          require('os').tmpdir(),
          'okvevo',
          ctx.sessionId,
          `vision_${Date.now()}${ext}`
        );

        try {
          await downloadFile(image_url, tempPath);

          const buf = fs.readFileSync(tempPath);
          const base64 = buf.toString('base64');
          const mimeType = detectMimeType(tempPath);

          const analysis = await callOpenRouterVision(base64, mimeType, question);

          return { success: true, analysis };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Vision analysis failed: ${message}`);
        } finally {
          try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          } catch {
            // ignore cleanup errors
          }
        }
      },
    }),
  };
}
