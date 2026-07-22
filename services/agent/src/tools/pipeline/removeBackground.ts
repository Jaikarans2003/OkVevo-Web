// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import { downloadFile, execCommand, getSessionWorkdir } from '../lib/utils';
import { getTempPath, uploadToStorage, writeAssetUrl } from '../../storage';

function resolveHyperframesCli(): string {
  return (
    process.env.HYPERFRAMES_CLI ??
    '/usr/local/lib/node_modules/hyperframes/dist/cli.js'
  );
}

/** HyperFrames cutouts are encoded -an; remux source audio onto the WebM. */
async function muxSourceAudio(
  videoPath: string,
  audioSourcePath: string,
  outputPath: string
): Promise<{ kept_audio: boolean }> {
  const probe = await execCommand(
    `ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "${audioSourcePath}"`,
    { timeoutSeconds: 30 }
  );
  const hasAudio = probe.success && probe.stdout.trim().length > 0;
  if (!hasAudio) {
    fs.copyFileSync(videoPath, outputPath);
    return { kept_audio: false };
  }

  const mux = await execCommand(
    `ffmpeg -y -i "${videoPath}" -i "${audioSourcePath}"` +
      ` -map 0:v:0 -map 1:a:0 -c:v copy -c:a libopus -shortest "${outputPath}"`,
    { timeoutSeconds: 120 }
  );
  if (!mux.success) {
    throw new Error(mux.stderr || 'Failed to mux source audio onto cutout');
  }
  return { kept_audio: true };
}

export function createRemoveBackgroundTools(ctx: {
  sessionId: string;
  userId: string;
}) {
  return {
    remove_background: tool({
      description: `Remove the background from a person/portrait video using HyperFrames local matting (u²-net_human_seg). Downloads the source, writes a transparent VP9-alpha WebM cutout with source audio remuxed by default, uploads it to Firebase Storage, and returns the public URL. Optionally also emits an inverse-alpha background plate.`,
      inputSchema: z.object({
        video_url: z
          .string()
          .describe('Firebase Storage URL of the source video'),
        quality: z
          .enum(['fast', 'balanced', 'best'])
          .optional()
          .describe('Encoder quality preset; default balanced'),
        emit_background_plate: z
          .boolean()
          .optional()
          .describe(
            'If true, also write an inverse-alpha hole-cut plate for text-behind-subject layouts'
          ),
        keep_audio: z
          .boolean()
          .optional()
          .describe(
            'Remux original audio onto the cutout (default true). Set false for silent cutout.'
          ),
      }),
      execute: async ({
        video_url,
        quality = 'balanced',
        emit_background_plate = false,
        keep_audio = true,
      }) => {
        try {
          const workdir = getSessionWorkdir(ctx.sessionId);
          const inputPath = path.join(workdir, 'rb_source.mp4');
          const cutoutSilentPath = path.join(workdir, 'rb_cutout_silent.webm');
          const cutoutPath = path.join(workdir, 'rb_cutout.webm');
          const plateSilentPath = path.join(workdir, 'rb_plate_silent.webm');
          const platePath = path.join(workdir, 'rb_plate.webm');

          await downloadFile(video_url, inputPath);

          const cliPath = resolveHyperframesCli();
          if (!fs.existsSync(cliPath)) {
            throw new Error(
              `HyperFrames CLI not found at ${cliPath}. Set HYPERFRAMES_CLI.`
            );
          }

          const matteOut = keep_audio ? cutoutSilentPath : cutoutPath;
          let cmd =
            `node "${cliPath}" remove-background "${inputPath}"` +
            ` -o "${matteOut}" --quality ${quality}`;
          if (emit_background_plate) {
            cmd += ` --background-output "${keep_audio ? plateSilentPath : platePath}"`;
          }

          // CPU matting can be slow on long clips; allow up to 30 minutes.
          const result = await execCommand(cmd, {
            cwd: workdir,
            timeoutSeconds: 1800,
          });

          if (!result.success) {
            throw new Error(
              result.stderr || result.stdout || 'remove-background failed'
            );
          }

          if (!fs.existsSync(matteOut)) {
            throw new Error('Cutout file was not produced');
          }

          let keptAudio = false;
          if (keep_audio) {
            const muxed = await muxSourceAudio(
              cutoutSilentPath,
              inputPath,
              cutoutPath
            );
            keptAudio = muxed.kept_audio;
          }

          // Keep local copies for the session; upload helpers delete by default.
          const cutoutTemp = getTempPath(`${ctx.sessionId}_rb_cutout.webm`);
          fs.copyFileSync(cutoutPath, cutoutTemp);
          const cutoutStoragePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/cutout.webm`;
          const cutoutUrl = await uploadToStorage(
            cutoutTemp,
            cutoutStoragePath
          );
          await writeAssetUrl(
            ctx.userId,
            ctx.sessionId,
            'cutout_video',
            cutoutUrl
          );

          let plateUrl: string | undefined;
          if (emit_background_plate) {
            const plateMatte = keep_audio ? plateSilentPath : platePath;
            if (!fs.existsSync(plateMatte)) {
              throw new Error('Background plate file was not produced');
            }
            if (keep_audio) {
              await muxSourceAudio(plateSilentPath, inputPath, platePath);
            }
            const plateTemp = getTempPath(`${ctx.sessionId}_rb_plate.webm`);
            fs.copyFileSync(platePath, plateTemp);
            const plateStoragePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/plate.webm`;
            plateUrl = await uploadToStorage(plateTemp, plateStoragePath);
            await writeAssetUrl(
              ctx.userId,
              ctx.sessionId,
              'plate_video',
              plateUrl
            );
          }

          return {
            cutout_url: cutoutUrl,
            ...(plateUrl ? { plate_url: plateUrl } : {}),
            quality,
            emit_background_plate,
            keep_audio,
            kept_audio: keep_audio ? keptAudio : false,
            cli_log: (result.stdout || result.stderr || '').slice(0, 500),
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[remove_background]', ctx.sessionId, message);
          throw new Error(`Background removal failed: ${message}`);
        }
      },
    }),
  };
}
