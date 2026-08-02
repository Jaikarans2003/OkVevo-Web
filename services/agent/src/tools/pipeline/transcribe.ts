// @ts-nocheck
import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { tool } from 'ai';
import { z } from 'zod';
import { downloadFile, execCommand, getSessionWorkdir } from '../lib/utils';
import { getTempPath, uploadToStorage, writeAssetUrl } from '../../storage';
import { formatDuration } from '../../checkpoint';
import { assertTaggedUrlAllowed } from '../../taggedAssets';
import type { ToolCtx } from '../index';

export function createTranscribeTools(ctx: ToolCtx) {
  return {
    transcribe_video: tool({
      description: `Transcribe a teacher video using Groq Whisper. Call this first when the user provides a video URL. Downloads the video, transcribes it, uploads the transcript JSON to Firebase Storage, and returns the transcript text and storage URL.`,
      inputSchema: z.object({
        video_url: z.string().describe('Firebase Storage URL of the teacher video'),
      }),
      execute: async ({ video_url }) => {
        try {
          assertTaggedUrlAllowed(video_url, ctx.taggedArtifacts);
          const videoPath = getTempPath(`${ctx.sessionId}_video.mp4`);
          await downloadFile(video_url, videoPath);

          let inputFile = videoPath;
          const stats = fs.statSync(videoPath);
          if (stats.size > 24 * 1024 * 1024) {
            const audioPath = getTempPath(`${ctx.sessionId}_audio.mp3`);
            const ffmpeg = await execCommand(
              `ffmpeg -i "${videoPath}" -vn -acodec mp3 -ar 16000 -ac 1 "${audioPath}"`,
              { timeoutSeconds: 120 }
            );
            if (!ffmpeg.success) {
              throw new Error(ffmpeg.stderr || 'ffmpeg audio extraction failed');
            }
            inputFile = audioPath;
          }

          const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
          const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(inputFile),
            model: 'whisper-large-v3',
            response_format: 'verbose_json',
            timestamp_granularities: ['word', 'segment'],
          });

          const verbose = transcription as typeof transcription & {
            segments?: { start: number; end: number; text: string }[];
            words?: { word: string; start: number; end: number }[];
            duration?: number;
          };

          const transcriptData = {
            text: transcription.text,
            words: verbose.words ?? [],
            segments: verbose.segments ?? [],
            duration_seconds: verbose.duration ?? 0,
          };

          const transcriptPath = getTempPath(`${ctx.sessionId}_transcript.json`);
          fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));

          fs.writeFileSync(
            path.join(getSessionWorkdir(ctx.sessionId), 'transcript.json'),
            JSON.stringify(transcriptData, null, 2)
          );

          const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/transcript.json`;
          const transcriptUrl = await uploadToStorage(transcriptPath, storagePath);
          await writeAssetUrl(ctx.userId, ctx.sessionId, 'transcript', transcriptUrl);

          return {
            transcript_url: transcriptUrl,
            transcript_text: transcription.text,
            duration_seconds: verbose.duration ?? 0,
            word_count: verbose.words?.length ?? 0,
            duration: formatDuration(verbose.duration ?? 0),
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[transcribe_video]', ctx.sessionId, message);
          throw new Error(`Transcription failed: ${message}`);
        }
      },
    }),
  };
}
