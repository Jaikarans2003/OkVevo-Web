// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import { downloadFile, execCommand, getSessionWorkdir } from '../lib/utils';
import { getTempPath, uploadToStorage, writeAssetUrl } from '../../storage';

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
};

type ProbeData = {
  streams?: ProbeStream[];
  format?: { duration?: string; format_name?: string };
};

async function ffprobeJson(filePath: string): Promise<ProbeData> {
  const result = await execCommand(
    `ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,duration` +
      ` -show_entries format=duration,format_name -of json "${filePath}"`,
    { timeoutSeconds: 60 }
  );
  if (!result.success) {
    throw new Error(result.stderr || 'ffprobe failed');
  }
  return JSON.parse(result.stdout) as ProbeData;
}

function pickVideoStream(probe: ProbeData): ProbeStream | null {
  return probe.streams?.find((s) => s.codec_type === 'video') ?? null;
}

function hasAudio(probe: ProbeData): boolean {
  return Boolean(probe.streams?.some((s) => s.codec_type === 'audio'));
}

function parseDuration(probe: ProbeData): number {
  const fromFormat = Number(probe.format?.duration);
  if (Number.isFinite(fromFormat) && fromFormat > 0) return fromFormat;
  for (const stream of probe.streams ?? []) {
    const d = Number(stream.duration);
    if (Number.isFinite(d) && d > 0) return d;
  }
  return 0;
}

function isImageFile(filePath: string, probe: ProbeData): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {
    return true;
  }
  const format = (probe.format?.format_name ?? '').toLowerCase();
  if (format.includes('image') || format.includes('png') || format.includes('jpeg')) {
    return true;
  }
  const video = pickVideoStream(probe);
  // Single-frame image demuxers often report tiny/no duration
  const duration = parseDuration(probe);
  return Boolean(video?.width && duration > 0 && duration < 0.15);
}

export function createCompositeSubjectTools(ctx: {
  sessionId: string;
  userId: string;
}) {
  return {
    composite_subject: tool({
      description: `Composite a transparent subject cutout (WebM/MOV with alpha) over a background image or video using ffmpeg. Preserves cutout audio when present. Uploads the final MP4 to Firebase Storage and returns the public URL.`,
      inputSchema: z.object({
        cutout_url: z
          .string()
          .describe('Firebase URL of the transparent cutout video (alpha WebM)'),
        background_url: z
          .string()
          .describe(
            'Firebase URL of the background image (png/jpg) or background video (mp4/webm)'
          ),
        layout: z
          .enum(['fill', 'fit', 'bottom-center'])
          .optional()
          .describe(
            'Subject placement: fill (default), fit (letterboxed), bottom-center (talking-head)'
          ),
        width: z
          .number()
          .optional()
          .describe('Output width; default = cutout width'),
        height: z
          .number()
          .optional()
          .describe('Output height; default = cutout height'),
      }),
      execute: async ({
        cutout_url,
        background_url,
        layout = 'fill',
        width,
        height,
      }) => {
        try {
          const workdir = getSessionWorkdir(ctx.sessionId);
          const cutoutPath = path.join(workdir, 'composite_cutout.webm');
          const bgPath = path.join(workdir, 'composite_bg');
          const outPath = path.join(workdir, 'composite_out.mp4');

          await downloadFile(cutout_url, cutoutPath);
          await downloadFile(background_url, bgPath);

          const cutoutProbe = await ffprobeJson(cutoutPath);
          const bgProbe = await ffprobeJson(bgPath);
          const cutoutVideo = pickVideoStream(cutoutProbe);
          if (!cutoutVideo?.width || !cutoutVideo?.height) {
            throw new Error('Cutout has no video stream');
          }

          const outW = width ?? cutoutVideo.width;
          const outH = height ?? cutoutVideo.height;
          const bgIsImage = isImageFile(bgPath, bgProbe);
          const cutoutHasAudio = hasAudio(cutoutProbe);
          const bgHasAudio = !bgIsImage && hasAudio(bgProbe);

          // Build filter: scale bg to cover canvas, overlay subject with alpha.
          const bgScale =
            `[0:v]scale=${outW}:${outH}:force_original_aspect_ratio=increase,` +
            `crop=${outW}:${outH},setsar=1[bg]`;

          let fgScale: string;
          let overlayPos: string;
          if (layout === 'bottom-center') {
            fgScale = `[1:v]format=rgba,scale=${Math.round(outW * 0.75)}:-1:flags=lanczos[fg]`;
            overlayPos = '(W-w)/2:H-h';
          } else if (layout === 'fit') {
            fgScale =
              `[1:v]format=rgba,scale=${outW}:${outH}:force_original_aspect_ratio=decrease[fg]`;
            overlayPos = '(W-w)/2:(H-h)/2';
          } else {
            fgScale =
              `[1:v]format=rgba,scale=${outW}:${outH}:force_original_aspect_ratio=increase,` +
              `crop=${outW}:${outH}[fg]`;
            overlayPos = '0:0';
          }

          const filter =
            `${bgScale};${fgScale};` +
            `[bg][fg]overlay=${overlayPos}:format=auto,format=yuv420p[v]`;

          const bgInput = bgIsImage
            ? `-loop 1 -i "${bgPath}"`
            : `-i "${bgPath}"`;
          // Decode VP9-alpha cutouts explicitly when needed.
          const cutoutInput = `-c:v libvpx-vp9 -i "${cutoutPath}"`;

          let mapAudio = '';
          if (cutoutHasAudio) {
            mapAudio = '-map 1:a:0 -c:a aac -b:a 192k';
          } else if (bgHasAudio) {
            mapAudio = '-map 0:a:0 -c:a aac -b:a 192k';
          } else {
            mapAudio = '-an';
          }

          const cmd =
            `ffmpeg -y ${bgInput} ${cutoutInput}` +
            ` -filter_complex "${filter}" -map "[v]" ${mapAudio}` +
            ` -shortest -movflags +faststart "${outPath}"`;

          const render = await execCommand(cmd, {
            cwd: workdir,
            timeoutSeconds: 600,
          });
          if (!render.success) {
            throw new Error(render.stderr || render.stdout || 'ffmpeg composite failed');
          }
          if (!fs.existsSync(outPath)) {
            throw new Error('Composite output was not produced');
          }

          const tempPath = getTempPath(`${ctx.sessionId}_composite.mp4`);
          fs.copyFileSync(outPath, tempPath);
          const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/composite.mp4`;
          const videoUrl = await uploadToStorage(tempPath, storagePath);
          await writeAssetUrl(
            ctx.userId,
            ctx.sessionId,
            'composite_video',
            videoUrl
          );
          await writeAssetUrl(
            ctx.userId,
            ctx.sessionId,
            'draft_video',
            videoUrl
          );

          const outProbe = await ffprobeJson(outPath);

          return {
            video_url: videoUrl,
            layout,
            width: outW,
            height: outH,
            background_type: bgIsImage ? 'image' : 'video',
            kept_audio: cutoutHasAudio || bgHasAudio,
            audio_source: cutoutHasAudio
              ? 'cutout'
              : bgHasAudio
                ? 'background'
                : 'none',
            duration_seconds: parseDuration(outProbe) || null,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[composite_subject]', ctx.sessionId, message);
          throw new Error(`Composite failed: ${message}`);
        }
      },
    }),
  };
}
