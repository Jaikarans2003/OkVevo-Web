// @ts-nocheck
import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { tool } from 'ai';
import { z } from 'zod';
import { downloadFile, getSessionWorkdir } from '../lib/utils';
import { getTempPath, uploadToStorage, writeAssetUrl, getAssetUrl } from '../../storage';
import {
  formatDuration,
  getSessionCaptionMode,
  getSessionRequestedLanguage,
  loadCheckpoint,
  persistCaptionMode,
  writeAskCheckpoint,
} from '../../checkpoint';
import { assertTaggedUrlAllowed } from '../../taggedAssets';
import type { ToolCtx } from '../index';
import {
  cleanupTranscriptionLocals,
  extractFlac,
  extractSingleWindow,
  logTmpDisk,
  materializeWindows,
  MAX_RESPLIT_DEPTH,
  planWindows,
  probeDurationSeconds,
  splitWindowInHalf,
  transcriptionDir,
  unlinkQuiet,
  type AudioWindow,
} from '../lib/audioChunks';
import {
  flacMatchesVideo,
  flacSourceUrlLocalPath,
  writeFlacSourceUrl,
} from '../lib/flacSourceUrl';
import { invalidateFullAudio } from '../lib/ensureFullAudio';
import {
  stitchChunkTranscripts,
  type ChunkTranscript,
} from '../lib/transcriptStitch';
import { sanitizeTranscriptWords } from '../lib/transcriptSanitize';
import {
  clearTranscriptionProgress,
  deleteTranscriptionChunkObjects,
  loadChunkResult,
  persistChunkResult,
  readTranscriptionProgress,
  writeTranscriptionProgress,
  type TranscriptionProgress,
} from '../lib/transcriptionProgress';
import {
  normalizeLanguageCode,
} from '../lib/transliteration/transliterateWords';
import { CAPTION_LANGUAGE_CHECKPOINT_CHOICES } from '../lib/transliteration/sarvamLanguages';
import { languageForDetectRepass } from '../lib/forceLanguageRepass';
import { pinnedLanguageFromRequest } from '../lib/transcriptionLanguage';

const FAIL_CHOICES = new Set<string>(['retry', 'continue', 'abort']);

function keepPinnedLanguage(
  p: TranscriptionProgress | null | undefined
): Pick<TranscriptionProgress, 'pinnedLanguage'> {
  return {
    ...(p?.pinnedLanguage ? { pinnedLanguage: p.pinnedLanguage } : {}),
  };
}

type VerboseResult = {
  text: string;
  words: { word: string; start: number; end: number }[];
  segments: { start: number; end: number; text: string }[];
  duration?: number;
  language?: string;
};

type ProviderKind = 'groq' | 'openrouter';

class ProviderError extends Error {
  status?: number;
  kind: 'transient' | 'permanent' | 'too_large' | 'words_missing';
  provider: ProviderKind;

  constructor(
    message: string,
    opts: {
      status?: number;
      kind: ProviderError['kind'];
      provider: ProviderKind;
    }
  ) {
    super(message);
    this.status = opts.status;
    this.kind = opts.kind;
    this.provider = opts.provider;
  }
}

function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { status?: number; statusCode?: number; error?: { status?: number } };
  return e.status ?? e.statusCode ?? e.error?.status;
}

function classifyHttpStatus(status: number | undefined): ProviderError['kind'] {
  if (status === 413) return 'too_large';
  if (status === 429 || status === 498 || status === 500 || status === 502 || status === 503) {
    return 'transient';
  }
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 422
  ) {
    return 'permanent';
  }
  return 'transient';
}

function assertWordsPresent(raw: Record<string, unknown>, provider: ProviderKind): void {
  if (!('words' in raw) || raw.words == null) {
    throw new ProviderError(`${provider}: words key missing/null`, {
      kind: 'words_missing',
      provider,
    });
  }
  if (!Array.isArray(raw.words)) {
    throw new ProviderError(`${provider}: words is not an array`, {
      kind: 'words_missing',
      provider,
    });
  }
}

function normalizeVerbose(raw: Record<string, unknown>): VerboseResult {
  const words = (raw.words as VerboseResult['words']) ?? [];
  const segments = (raw.segments as VerboseResult['segments']) ?? [];
  return {
    text: typeof raw.text === 'string' ? raw.text : words.map((w) => w.word).join(' '),
    words,
    segments,
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
    language: typeof raw.language === 'string' ? raw.language : undefined,
  };
}

async function callGroq(chunkPath: string, language?: string): Promise<VerboseResult> {
  if (process.env.TRANSCRIBE_FORCE_GROQ_FAIL === '1') {
    throw new ProviderError('TRANSCRIBE_FORCE_GROQ_FAIL', {
      status: 503,
      kind: 'transient',
      provider: 'groq',
    });
  }
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(chunkPath),
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
      ...(language ? { language } : {}),
    });
    const raw = transcription as unknown as Record<string, unknown>;
    assertWordsPresent(raw, 'groq');
    return normalizeVerbose(raw);
  } catch (err: unknown) {
    if (err instanceof ProviderError) throw err;
    const status = statusOf(err);
    throw new ProviderError(
      err instanceof Error ? err.message : String(err),
      { status, kind: classifyHttpStatus(status), provider: 'groq' }
    );
  }
}

async function callOpenRouterAudio(
  chunkPath: string,
  language?: string
): Promise<VerboseResult> {
  const buf = fs.readFileSync(chunkPath);
  const form = new FormData();
  form.append(
    'file',
    new File([buf], path.basename(chunkPath), { type: 'audio/flac' })
  );
  form.append('model', 'openai/whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  if (language) form.append('language', language);

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: form,
    });
  } catch (err: unknown) {
    throw new ProviderError(err instanceof Error ? err.message : String(err), {
      kind: 'transient',
      provider: 'openrouter',
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ProviderError(`OpenRouter ${response.status}: ${text.slice(0, 400)}`, {
      status: response.status,
      kind: classifyHttpStatus(response.status),
      provider: 'openrouter',
    });
  }

  const raw = (await response.json()) as Record<string, unknown>;
  assertWordsPresent(raw, 'openrouter');
  return normalizeVerbose(raw);
}

/** Groq (retry if transient) → OpenRouter (retry if transient). 413 → too_large. */
async function transcribeOnce(
  chunkPath: string,
  language?: string
): Promise<{
  result: VerboseResult;
  provider: ProviderKind;
}> {
  async function tryProvider(
    provider: ProviderKind,
    fn: () => Promise<VerboseResult>
  ): Promise<VerboseResult> {
    try {
      return await fn();
    } catch (err: unknown) {
      const pe =
        err instanceof ProviderError
          ? err
          : new ProviderError(String(err), { kind: 'transient', provider });
      console.error('[transcribe_video] provider_fail', {
        provider,
        kind: pe.kind,
        status: pe.status,
        message: pe.message.slice(0, 300),
      });
      if (pe.kind === 'too_large') throw pe;
      if (pe.kind === 'transient') {
        try {
          return await fn();
        } catch (err2: unknown) {
          const pe2 =
            err2 instanceof ProviderError
              ? err2
              : new ProviderError(String(err2), { kind: 'transient', provider });
          console.error('[transcribe_video] provider_fail', {
            provider,
            kind: pe2.kind,
            status: pe2.status,
            message: pe2.message.slice(0, 300),
            retry: true,
          });
          if (pe2.kind === 'too_large') throw pe2;
          throw pe2;
        }
      }
      throw pe;
    }
  }

  try {
    const result = await tryProvider('groq', () => callGroq(chunkPath, language));
    return { result, provider: 'groq' };
  } catch (err: unknown) {
    if (err instanceof ProviderError && err.kind === 'too_large') throw err;
    console.error('[transcribe_video] falling_back_openrouter', {
      reason: err instanceof Error ? err.message.slice(0, 200) : String(err),
    });
  }

  const result = await tryProvider('openrouter', () =>
    callOpenRouterAudio(chunkPath, language)
  );
  return { result, provider: 'openrouter' };
}

async function transcribeWindowWithResplit(
  flacPath: string,
  sessionId: string,
  win: AudioWindow,
  depth: number,
  language?: string
): Promise<ChunkTranscript> {
  try {
    const { result, provider } = await transcribeOnce(win.path, language);
    console.error('[transcribe_video] chunk_ok', sessionId, {
      index: win.index,
      provider,
      depth,
      start: win.startOffsetSeconds,
      duration: win.durationSeconds,
      words: result.words.length,
      language: result.language ?? language,
    });
    return {
      words: result.words,
      segments: result.segments,
      text: result.text,
      startOffsetSeconds: win.startOffsetSeconds,
      durationSeconds: win.durationSeconds,
      provider,
      ...(result.language !== undefined
        ? { language: result.language }
        : language
          ? { language }
          : {}),
    };
  } catch (err: unknown) {
    if (
      err instanceof ProviderError &&
      err.kind === 'too_large' &&
      depth < MAX_RESPLIT_DEPTH
    ) {
      console.error('[transcribe_video] resplit_413', sessionId, {
        index: win.index,
        depth,
      });
      const [a, b] = await splitWindowInHalf(flacPath, sessionId, win, depth + 1);
      const left = await transcribeWindowWithResplit(
        flacPath,
        sessionId,
        a,
        depth + 1,
        language
      );
      const right = await transcribeWindowWithResplit(
        flacPath,
        sessionId,
        b,
        depth + 1,
        language
      );
      const stitched = stitchChunkTranscripts(
        [left, right],
        win.durationSeconds
      );
      return {
        words: stitched.words.map((w) => ({
          ...w,
          start: w.start - win.startOffsetSeconds,
          end: w.end - win.startOffsetSeconds,
        })),
        segments: stitched.segments.map((s) => ({
          ...s,
          start: s.start - win.startOffsetSeconds,
          end: s.end - win.startOffsetSeconds,
        })),
        text: stitched.text,
        startOffsetSeconds: win.startOffsetSeconds,
        durationSeconds: win.durationSeconds,
        ...(stitched.language !== undefined ? { language: stitched.language } : {}),
        ...(left.provider ? { provider: left.provider } : {}),
      };
    }
    throw err;
  }
}

async function ensureFlac(
  sessionId: string,
  videoUrl: string,
  videoPath: string
): Promise<{ flacPath: string; durationSeconds: number }> {
  const flacPath = path.join(transcriptionDir(sessionId), 'audio.flac');
  if (!flacMatchesVideo(flacPath, videoUrl)) {
    unlinkQuiet(flacPath);
    unlinkQuiet(flacSourceUrlLocalPath(flacPath));
    logTmpDisk(sessionId, 'pre-extract');
    if (!fs.existsSync(videoPath)) {
      await downloadFile(videoUrl, videoPath);
    }
    await extractFlac(videoPath, flacPath);
    writeFlacSourceUrl(flacPath, videoUrl);
    unlinkQuiet(videoPath);
    logTmpDisk(sessionId, 'post-extract');
  }
  const durationSeconds = await probeDurationSeconds(flacPath);
  return { flacPath, durationSeconds };
}

export function createTranscribeTools(ctx: ToolCtx) {
  return {
    transcribe_video: tool({
      description: `Transcribe a teacher video (Groq Whisper with OpenRouter fallback, chunked for long videos). Downloads the video, extracts FLAC, transcribes overlapping chunks, uploads transcript JSON to Firebase Storage, and returns the transcript text and storage URL.`,
      inputSchema: z.object({
        video_url: z.string().describe('Firebase Storage URL of the teacher video'),
      }),
      execute: async ({ video_url }) => {
        const videoPath = getTempPath(`${ctx.sessionId}_video.mp4`);
        const localsExtra: string[] = [videoPath];

        try {
          assertTaggedUrlAllowed(video_url, ctx.taggedArtifacts);

          let progress = await readTranscriptionProgress(ctx.sessionId);

          // Stale progress (different video) → start fresh.
          if (progress && progress.videoUrl !== video_url) {
            console.error('[transcribe_video] stale_progress', ctx.sessionId, {
              progressUrl: progress.videoUrl,
              video_url,
            });
            await clearTranscriptionProgress(ctx.sessionId);
            await deleteTranscriptionChunkObjects(ctx.userId, ctx.sessionId);
            await invalidateFullAudio(ctx.userId, ctx.sessionId);
            cleanupTranscriptionLocals(ctx.sessionId);
            const caption = await getSessionCaptionMode(ctx.sessionId);
            if (caption.captionMode) {
              await persistCaptionMode(ctx.sessionId, caption.captionMode, false);
            }
            progress = null;
          }

          // Complete + final transcript exists → reuse.
          if (progress?.status === 'complete') {
            const existingUrl = await getAssetUrl(ctx.userId, ctx.sessionId, 'transcript');
            const local = path.join(getSessionWorkdir(ctx.sessionId), 'transcript.json');
            if (existingUrl && !fs.existsSync(local)) {
              try {
                await downloadFile(existingUrl, local);
              } catch {
                // fall through to re-transcribe
              }
            }
            if (existingUrl && fs.existsSync(local)) {
              const saved = JSON.parse(fs.readFileSync(local, 'utf-8'));
              return {
                transcript_url: existingUrl,
                transcript_text: saved.text ?? '',
                duration_seconds: saved.duration_seconds ?? 0,
                word_count: Array.isArray(saved.words) ? saved.words.length : 0,
                duration: formatDuration(saved.duration_seconds ?? 0),
                reused: true,
                ...(saved.language ? { language: saved.language } : {}),
              };
            }
          }

          // Ask-mode: language select before extract (session field, not awaiting_user).
          const requestedLanguage =
            ctx.pipelineMode === 'ask'
              ? await getSessionRequestedLanguage(ctx.sessionId)
              : undefined;
          if (ctx.pipelineMode === 'ask' && !requestedLanguage) {
            const written = await writeAskCheckpoint(
              {
                sessionId: ctx.sessionId,
                userId: ctx.userId,
                skillName: ctx.skillName,
                pipelineMode: ctx.pipelineMode,
              },
              {
                phase_label: 'Transcription language',
                completedPhase: 'transcription',
                question: 'Choose language you require captions in.',
                choices: CAPTION_LANGUAGE_CHECKPOINT_CHOICES,
                allowFreeform: false,
                presentation: 'select',
                defaultChoiceId: 'en',
              }
            );
            return {
              haltTurn: true as const,
              checkpointId: written.checkpointId,
              checkpointDisplay: written.checkpointDisplay,
              transcription_language_paused: true,
            };
          }

          // Ask-mode resume from checkpoint choice (style vs chunk-failure).
          let resumeChoice: string | undefined;
          let retryIndex: number | undefined;
          if (progress?.status === 'awaiting_user') {
            if (progress.checkpointId) {
              const cp = await loadCheckpoint(ctx.sessionId, progress.checkpointId);
              resumeChoice = cp?.answer?.choiceId;
            }
            if (!resumeChoice) {
              throw new Error(
                'Transcription awaiting user choice — answer the checkpoint first'
              );
            }
            if (resumeChoice === 'abort') {
              await clearTranscriptionProgress(ctx.sessionId);
              await deleteTranscriptionChunkObjects(ctx.userId, ctx.sessionId);
              cleanupTranscriptionLocals(ctx.sessionId, localsExtra);
              throw new Error('Transcription aborted by user');
            } else if (resumeChoice === 'retry' && progress.failedChunk) {
              retryIndex = progress.failedChunk.index;
            } else if (!FAIL_CHOICES.has(resumeChoice)) {
              throw new Error(
                `Unknown transcription checkpoint choice: ${resumeChoice}`
              );
            }
          }

          const { flacPath, durationSeconds } = await ensureFlac(
            ctx.sessionId,
            video_url,
            videoPath
          );
          localsExtra.push(flacPath);

          const planned = planWindows(durationSeconds);
          const completedSet = new Set(progress?.completedChunkIndices ?? []);
          let pinnedLanguage = progress?.pinnedLanguage;

          // Handle continue: mark failed chunk as skipped gap and proceed.
          if (resumeChoice === 'continue' && progress?.failedChunk) {
            const fc = progress.failedChunk;
            await persistChunkResult(ctx.userId, ctx.sessionId, {
              index: fc.index,
              words: [],
              segments: [],
              text: '',
              startOffsetSeconds: fc.startOffsetSeconds,
              durationSeconds: fc.durationSeconds,
              skipped: true,
            });
            completedSet.add(fc.index);
            progress = {
              videoUrl: video_url,
              totalChunks: planned.length,
              completedChunkIndices: [...completedSet].sort((a, b) => a - b),
              status: 'in_progress',
              gaps: [
                ...(progress.gaps ?? []),
                {
                  index: fc.index,
                  startOffsetSeconds: fc.startOffsetSeconds,
                  durationSeconds: fc.durationSeconds,
                },
              ],
              ...keepPinnedLanguage(progress),
              ...(pinnedLanguage ? { pinnedLanguage } : {}),
            };
            await writeTranscriptionProgress(ctx.sessionId, progress);
          } else if (!progress || progress.status === 'aborted' || progress.status === 'complete') {
            // Fresh start (complete-without-artifact = re-Whisper).
            completedSet.clear();
            pinnedLanguage = pinnedLanguageFromRequest(requestedLanguage);
            progress = {
              videoUrl: video_url,
              totalChunks: planned.length,
              completedChunkIndices: [],
              status: 'in_progress',
              ...(pinnedLanguage ? { pinnedLanguage } : {}),
            };
            await writeTranscriptionProgress(ctx.sessionId, progress);
          } else {
            pinnedLanguage = pinnedLanguageFromRequest(
              requestedLanguage,
              pinnedLanguage
            );
            progress = {
              ...progress,
              totalChunks: planned.length,
              status: 'in_progress',
              failedChunk:
                resumeChoice === 'retry' ? undefined : progress.failedChunk,
              ...(pinnedLanguage ? { pinnedLanguage } : {}),
            };
            await writeTranscriptionProgress(ctx.sessionId, progress);
          }

          // Materialize only windows we still need (or retry target).
          const needIndices = planned
            .filter((w) => {
              if (retryIndex !== undefined) {
                return w.index === retryIndex || !completedSet.has(w.index);
              }
              return !completedSet.has(w.index);
            })
            .map((w) => w.index);

          const windowsToRun = planned.filter((w) => needIndices.includes(w.index));
          const materialized =
            windowsToRun.length > 0
              ? await materializeWindows(flacPath, ctx.sessionId, windowsToRun)
              : [];
          logTmpDisk(ctx.sessionId, 'post-chunk');

          // Group materialize leaves by plan index (size re-split may produce multiple).
          const byIndex = new Map<number, AudioWindow[]>();
          for (const w of materialized) {
            const list = byIndex.get(w.index) ?? [];
            list.push(w);
            byIndex.set(w.index, list);
          }

          const gaps: NonNullable<TranscriptionProgress['gaps']> = [
            ...(progress.gaps ?? []),
          ];

          for (const plan of planned) {
            if (completedSet.has(plan.index) && plan.index !== retryIndex) {
              continue;
            }

            const pieces = byIndex.get(plan.index) ?? [
              await extractSingleWindow(flacPath, ctx.sessionId, plan),
            ];

            const runChunk = async (): Promise<ChunkTranscript> => {
              // Chunk 0 (and any chunk before pin): omit language. Later: pass pin.
              const langArg = pinnedLanguage;
              if (pieces.length === 1) {
                return transcribeWindowWithResplit(
                  flacPath,
                  ctx.sessionId,
                  pieces[0],
                  0,
                  langArg
                );
              }
              const parts: ChunkTranscript[] = [];
              for (const piece of pieces) {
                parts.push(
                  await transcribeWindowWithResplit(
                    flacPath,
                    ctx.sessionId,
                    piece,
                    0,
                    langArg
                  )
                );
              }
              const stitched = stitchChunkTranscripts(parts, plan.durationSeconds);
              return {
                words: stitched.words.map((w) => ({
                  ...w,
                  start: w.start - plan.startOffsetSeconds,
                  end: w.end - plan.startOffsetSeconds,
                })),
                segments: stitched.segments.map((s) => ({
                  ...s,
                  start: s.start - plan.startOffsetSeconds,
                  end: s.end - plan.startOffsetSeconds,
                })),
                text: stitched.text,
                startOffsetSeconds: plan.startOffsetSeconds,
                durationSeconds: plan.durationSeconds,
                ...(stitched.language !== undefined ? { language: stitched.language } : {}),
                ...(parts[0]?.provider ? { provider: parts[0].provider } : {}),
              };
            };

            let chunkResult: ChunkTranscript | null = null;
            let failReason = '';
            const firstCallHadLanguage = Boolean(pinnedLanguage);

            const applyDetectRepass = async (
              first: ChunkTranscript
            ): Promise<ChunkTranscript> => {
              if (!pinnedLanguage && first.language) {
                pinnedLanguage =
                  normalizeLanguageCode(first.language) ?? first.language;
              }
              const forceLang = languageForDetectRepass({
                firstCallHadLanguage,
                detectedLanguage: pinnedLanguage,
                forceFail: process.env.TRANSCRIBE_FORCE_GROQ_FAIL === '1',
              });
              if (!forceLang) return first;
              console.error('[transcribe_video] twopass_force_language', ctx.sessionId, {
                index: plan.index,
                language: forceLang,
              });
              return runChunk();
            };

            try {
              chunkResult = await applyDetectRepass(await runChunk());
            } catch (err: unknown) {
              failReason = err instanceof Error ? err.message : String(err);

              if (ctx.pipelineMode === 'ask') {
                const failedChunk = {
                  index: plan.index,
                  startOffsetSeconds: plan.startOffsetSeconds,
                  durationSeconds: plan.durationSeconds,
                  reason: failReason.slice(0, 500),
                };
                const written = await writeAskCheckpoint(
                  {
                    sessionId: ctx.sessionId,
                    userId: ctx.userId,
                    skillName: ctx.skillName,
                    pipelineMode: ctx.pipelineMode,
                  },
                  {
                    phase_label: 'Transcription paused',
                    question: `Chunk ${plan.index + 1}/${planned.length} failed (${formatDuration(plan.startOffsetSeconds)}–${formatDuration(plan.startOffsetSeconds + plan.durationSeconds)}). Retry, continue with a gap, or abort?`,
                    context: failReason.slice(0, 300),
                    choices: [
                      { id: 'retry', label: 'Retry this chunk' },
                      { id: 'continue', label: 'Continue with gap' },
                      { id: 'abort', label: 'Abort transcription' },
                    ],
                    allowFreeform: false,
                  }
                );
                await writeTranscriptionProgress(ctx.sessionId, {
                  videoUrl: video_url,
                  totalChunks: planned.length,
                  completedChunkIndices: [...completedSet].sort((a, b) => a - b),
                  failedChunk,
                  status: 'awaiting_user',
                  checkpointId: written.checkpointId,
                  gaps,
                  ...keepPinnedLanguage(progress),
                  ...(pinnedLanguage ? { pinnedLanguage } : {}),
                });
                // Keep FLAC for resume; /tmp is cache — progress+Storage are source of truth.
                return {
                  haltTurn: true as const,
                  checkpointId: written.checkpointId,
                  checkpointDisplay: written.checkpointDisplay,
                  transcription_paused: true,
                  failed_chunk: failedChunk,
                };
              }

              // Auto-run: up to 2 more full provider sequences, then gap.
              for (let autoTry = 1; autoTry <= 2; autoTry++) {
                try {
                  console.error('[transcribe_video] auto_retry', ctx.sessionId, {
                    index: plan.index,
                    autoTry,
                  });
                  // Re-extract in case local piece was wiped.
                  const fresh = await extractSingleWindow(flacPath, ctx.sessionId, plan);
                  chunkResult = await applyDetectRepass(
                    await transcribeWindowWithResplit(
                      flacPath,
                      ctx.sessionId,
                      fresh,
                      0,
                      pinnedLanguage
                    )
                  );
                  failReason = '';
                  break;
                } catch (retryErr: unknown) {
                  failReason =
                    retryErr instanceof Error ? retryErr.message : String(retryErr);
                }
              }

              if (!chunkResult) {
                console.error('[transcribe_video] auto_gap', ctx.sessionId, {
                  index: plan.index,
                  reason: failReason.slice(0, 300),
                });
                chunkResult = {
                  words: [],
                  segments: [],
                  text: '',
                  startOffsetSeconds: plan.startOffsetSeconds,
                  durationSeconds: plan.durationSeconds,
                  skipped: true,
                };
                gaps.push({
                  index: plan.index,
                  startOffsetSeconds: plan.startOffsetSeconds,
                  durationSeconds: plan.durationSeconds,
                });
              }
            }

            await persistChunkResult(ctx.userId, ctx.sessionId, {
              index: plan.index,
              ...chunkResult,
            });
            completedSet.add(plan.index);
            if (!pinnedLanguage && chunkResult.language) {
              pinnedLanguage =
                normalizeLanguageCode(chunkResult.language) ?? chunkResult.language;
            }
            progress = {
              videoUrl: video_url,
              totalChunks: planned.length,
              completedChunkIndices: [...completedSet].sort((a, b) => a - b),
              status: 'in_progress',
              gaps,
              ...keepPinnedLanguage(progress),
              ...(pinnedLanguage ? { pinnedLanguage } : {}),
            };
            await writeTranscriptionProgress(ctx.sessionId, progress);
          }

          // Assemble from durable chunk JSONs (covers resume + this run).
          const assembled: (ChunkTranscript & { index: number })[] = [];
          for (const plan of planned) {
            const loaded = await loadChunkResult(ctx.userId, ctx.sessionId, plan.index, {
              startOffsetSeconds: plan.startOffsetSeconds,
              durationSeconds: plan.durationSeconds,
            });
            if (!loaded) {
              throw new Error(
                `Missing transcription chunk ${plan.index} after processing — cannot stitch`
              );
            }
            assembled.push({ ...loaded, index: plan.index });
            if (!pinnedLanguage && loaded.language) {
              pinnedLanguage =
                normalizeLanguageCode(loaded.language) ?? loaded.language;
            }
          }

          const stitched = stitchChunkTranscripts(assembled, durationSeconds);
          if (!pinnedLanguage && stitched.language) {
            pinnedLanguage =
              normalizeLanguageCode(stitched.language) ?? stitched.language;
          }

          let transcriptData: {
            text: string;
            words: { word: string; start: number; end: number }[];
            segments: { start: number; end: number; text: string }[];
            duration_seconds: number;
            language?: string;
          } = {
            text: stitched.text,
            words: sanitizeTranscriptWords(stitched.words, durationSeconds),
            segments: stitched.segments,
            duration_seconds: stitched.duration_seconds,
            ...(stitched.language !== undefined
              ? { language: stitched.language }
              : pinnedLanguage
                ? { language: pinnedLanguage }
                : {}),
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

          // Keep status:complete so a re-call can reuse; drop chunk JSON blobs.
          await writeTranscriptionProgress(ctx.sessionId, {
            videoUrl: video_url,
            totalChunks: planned.length,
            completedChunkIndices: planned.map((p) => p.index),
            status: 'complete',
            gaps: stitched.gaps.length > 0 ? stitched.gaps : gaps,
            ...(pinnedLanguage ? { pinnedLanguage } : {}),
          });
          await deleteTranscriptionChunkObjects(ctx.userId, ctx.sessionId);
          cleanupTranscriptionLocals(ctx.sessionId, localsExtra);

          return {
            transcript_url: transcriptUrl,
            transcript_text: transcriptData.text,
            duration_seconds: transcriptData.duration_seconds,
            word_count: transcriptData.words.length,
            duration: formatDuration(transcriptData.duration_seconds),
            ...(transcriptData.language !== undefined
              ? { language: transcriptData.language }
              : {}),
            ...(stitched.gaps.length > 0 || gaps.length > 0
              ? {
                  gaps: (stitched.gaps.length > 0 ? stitched.gaps : gaps).map((g) => ({
                    index: g.index,
                    start: g.startOffsetSeconds,
                    end: g.startOffsetSeconds + g.durationSeconds,
                    range: `${formatDuration(g.startOffsetSeconds)}–${formatDuration(g.startOffsetSeconds + g.durationSeconds)}`,
                  })),
                }
              : {}),
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const cause = err instanceof Error ? err.cause : undefined;
          const apiErr = err as {
            status?: number;
            statusCode?: number;
            error?: unknown;
          };
          console.error('[transcribe_video]', ctx.sessionId, {
            message,
            name: err instanceof Error ? err.name : undefined,
            stack: err instanceof Error ? err.stack : undefined,
            status: apiErr.status ?? apiErr.statusCode,
            errorBody: apiErr.error,
            cause:
              cause instanceof Error
                ? {
                    message: cause.message,
                    name: cause.name,
                    stack: cause.stack,
                    code: (cause as NodeJS.ErrnoException).code,
                  }
                : cause,
          });
          // Hard pre-chunk / abort failure: cleanup locals. Keep progress if awaiting_user.
          const prog = await readTranscriptionProgress(ctx.sessionId).catch(() => null);
          if (prog?.status !== 'awaiting_user') {
            cleanupTranscriptionLocals(ctx.sessionId, localsExtra);
          }
          if (message.includes('aborted by user')) throw err;
          // haltTurn returns shouldn't land here
          throw new Error(`Transcription failed: ${message}`);
        }
      },
    }),
  };
}
