// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import {
  formatDuration,
  getSessionCaptionMode,
  persistCaptionMode,
  writeAskCheckpoint,
} from '../../checkpoint';
import { getTempPath, uploadToStorage, writeAssetUrl } from '../../storage';
import type { ToolCtx } from '../index';
import { ensureFullAudio } from '../lib/ensureFullAudio';
import { readTranscriptionProgress } from '../lib/transcriptionProgress';
import {
  isSarvamSupportedLanguage,
  normalizeLanguageCode,
  transliterateWords,
  SarvamBatchError,
} from '../lib/transliteration/transliterateWords';
import { ensureSessionArtifacts, getSessionWorkdir } from '../lib/utils';

const NATIVE_BACKUP = 'transcript.native.json';
const SARVAM_RAW = 'sarvam_translit.json';

type TranscriptDoc = {
  text: string;
  words: { word: string; start: number; end: number }[];
  segments: { start: number; end: number; text: string }[];
  duration_seconds: number;
  language?: string;
  transliterationFallbacks?: number[];
};

function loadTranscriptDoc(sessionId: string): TranscriptDoc | null {
  const p = path.join(getSessionWorkdir(sessionId), 'transcript.json');
  if (!fs.existsSync(p)) return null;
  try {
    const saved = JSON.parse(fs.readFileSync(p, 'utf-8')) as TranscriptDoc;
    if (!saved || (!saved.text && !(saved.words?.length > 0))) return null;
    return {
      text: typeof saved.text === 'string' ? saved.text : '',
      words: Array.isArray(saved.words) ? saved.words : [],
      segments: Array.isArray(saved.segments) ? saved.segments : [],
      duration_seconds:
        typeof saved.duration_seconds === 'number' ? saved.duration_seconds : 0,
      ...(typeof saved.language === 'string' ? { language: saved.language } : {}),
    };
  } catch {
    return null;
  }
}

async function persistTranscript(
  ctx: ToolCtx,
  doc: TranscriptDoc
): Promise<string> {
  const workdir = getSessionWorkdir(ctx.sessionId);
  const local = path.join(workdir, 'transcript.json');
  fs.writeFileSync(local, JSON.stringify(doc, null, 2));
  const tmp = getTempPath(`${ctx.sessionId}_transcript.json`);
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2));
  const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/transcript.json`;
  const url = await uploadToStorage(tmp, storagePath);
  await writeAssetUrl(ctx.userId, ctx.sessionId, 'transcript', url);
  return url;
}

async function backupNative(ctx: ToolCtx, doc: TranscriptDoc): Promise<void> {
  const workdir = getSessionWorkdir(ctx.sessionId);
  const local = path.join(workdir, NATIVE_BACKUP);
  fs.writeFileSync(local, JSON.stringify(doc, null, 2));
  const tmp = getTempPath(`${ctx.sessionId}_transcript.native.json`);
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2));
  const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/${NATIVE_BACKUP}`;
  await uploadToStorage(tmp, storagePath);
}

async function persistSarvamRaw(ctx: ToolCtx, raw: unknown): Promise<void> {
  const workdir = getSessionWorkdir(ctx.sessionId);
  const local = path.join(workdir, SARVAM_RAW);
  fs.writeFileSync(local, JSON.stringify(raw, null, 2));
  const tmp = getTempPath(`${ctx.sessionId}_${SARVAM_RAW}`);
  fs.writeFileSync(tmp, JSON.stringify(raw, null, 2));
  const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/${SARVAM_RAW}`;
  await uploadToStorage(tmp, storagePath);
}

export function createTransliterateCaptionsTools(ctx: ToolCtx) {
  return {
    transliterate_captions: tool({
      description: `Ask-only caption style gate. After transcribe_video, choose Native vs English Worded captions. English Worded runs one Sarvam Batch translit job and maps text onto Groq word timestamps. Auto-run no-ops (native). Call before extract_concepts when a caption style choice is pending.`,
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.pipelineMode !== 'ask') {
          return {
            ok: true,
            noop: true,
            caption_mode: 'native',
            message:
              'Caption style selection only available in Ask mode; captions remain native.',
          };
        }

        await ensureSessionArtifacts(ctx.userId, ctx.sessionId, ['transcript']);
        const existing = await getSessionCaptionMode(ctx.sessionId);

        if (existing.captionMode && existing.captionModeApplied) {
          return {
            ok: true,
            noop: true,
            caption_mode: existing.captionMode,
            caption_mode_applied: true,
            message: 'Caption style already applied.',
          };
        }

        const transcript = loadTranscriptDoc(ctx.sessionId);
        if (!transcript) {
          throw new Error(
            'No session transcript. Call transcribe_video first before transliterate_captions.'
          );
        }

        const lang =
          transcript.language ??
          (await readTranscriptionProgress(ctx.sessionId))?.pinnedLanguage;
        const sarvamOk = isSarvamSupportedLanguage(normalizeLanguageCode(lang));

        // Language outside Sarvam 23 → hide english_worded; persist native applied.
        if (!sarvamOk) {
          await persistCaptionMode(ctx.sessionId, 'native', true);
          return {
            ok: true,
            caption_mode: 'native',
            caption_mode_applied: true,
            message:
              'English Worded captions unavailable for this language; left native.',
            ...(lang ? { language: lang } : {}),
          };
        }

        // Ask if choice not yet persisted.
        if (!existing.captionMode) {
          const written = await writeAskCheckpoint(
            {
              sessionId: ctx.sessionId,
              userId: ctx.userId,
              skillName: ctx.skillName,
              pipelineMode: ctx.pipelineMode,
            },
            {
              phase_label: 'Caption style',
              completedPhase: 'transcription',
              question: 'How should captions be written for this video?',
              context:
                'Native Language Captions keep the original script (e.g. Kannada, Hindi). English Worded Captions use romanized Latin letters for the same speech (Sarvam translit + Groq timings).',
              choices: [
                { id: 'native', label: 'Native Language Captions' },
                { id: 'english_worded', label: 'English Worded Captions' },
              ],
              allowFreeform: false,
            }
          );
          return {
            haltTurn: true as const,
            checkpointId: written.checkpointId,
            checkpointDisplay: written.checkpointDisplay,
            caption_style_paused: true,
          };
        }

        // Apply choice (captionModeApplied === false).
        if (existing.captionMode === 'native') {
          await persistCaptionMode(ctx.sessionId, 'native', true);
          const url = await persistTranscript(ctx, transcript);
          return {
            ok: true,
            caption_mode: 'native',
            caption_mode_applied: true,
            transcript_url: url,
            word_count: transcript.words.length,
            duration: formatDuration(transcript.duration_seconds),
          };
        }

        // english_worded
        const progress = await readTranscriptionProgress(ctx.sessionId);
        const videoUrl = progress?.videoUrl;
        if (!videoUrl) {
          throw new Error(
            'Missing transcriptionProgress.videoUrl — cannot re-extract audio for English Worded captions.'
          );
        }

        try {
          await backupNative(ctx, transcript);
          const audioPath = await ensureFullAudio({
            userId: ctx.userId,
            sessionId: ctx.sessionId,
            videoUrl,
          });
          const romanized = await transliterateWords({
            words: transcript.words,
            segments: transcript.segments,
            text: transcript.text,
            language: lang!,
            audioPath,
          });
          if (romanized.sarvamRaw !== undefined) {
            await persistSarvamRaw(ctx, romanized.sarvamRaw);
          }
          const out: TranscriptDoc = {
            ...transcript,
            text: romanized.text,
            words: romanized.words,
            segments: romanized.segments,
            ...(romanized.transliterationFallbacks
              ? { transliterationFallbacks: romanized.transliterationFallbacks }
              : {}),
          };
          const url = await persistTranscript(ctx, out);
          await persistCaptionMode(ctx.sessionId, 'english_worded', true);
          return {
            ok: true,
            caption_mode: 'english_worded',
            caption_mode_applied: true,
            transcript_url: url,
            transcript_text: out.text,
            word_count: out.words.length,
            duration: formatDuration(out.duration_seconds),
            ...(out.language ? { language: out.language } : {}),
            ...(out.transliterationFallbacks
              ? { transliterationFallbacks: out.transliterationFallbacks }
              : {}),
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const kind =
            err instanceof SarvamBatchError ? err.kind : 'permanent';
          console.error('[transliterate_captions] fail', {
            kind,
            message: message.slice(0, 400),
          });
          throw new Error(
            kind === 'transient'
              ? `English Worded captions failed (transient): ${message}. Retry transliterate_captions.`
              : `English Worded captions failed: ${message}`
          );
        }
      },
    }),
  };
}
