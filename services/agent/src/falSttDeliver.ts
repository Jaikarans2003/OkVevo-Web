import fs from 'fs';
import path from 'path';
import { FieldValue } from 'firebase-admin/firestore';
import { injectCheckpointPart } from './agent';
import { getSessionPipelineFields } from './checkpoint';
import { falQueueResult, falQueueStatus } from './falQueue';
import { clearPendingFalJob, readPendingFalJob, type PendingFalJob } from './pendingFalJob';
import {
  falSttDeliveryAction,
  progressUpdatedAtMs,
  resolveWakeClaim,
  shouldEscalateFalSttShortCircuit,
  shouldShortCircuitFalSttEntry,
  transcriptExistsNeedsWake,
} from './falSttIdempotency';
import type { FalEvent } from './deliverEventParse';
import { db } from './firebase';
import { saveMessage } from './session';
import { getAssetUrl, getTempPath, uploadToStorage, writeAssetUrl } from './storage';
import {
  ELEVENLABS_SCRIBE_V2_MODEL,
  type ElevenLabsSttResult,
} from './tools/lib/elevenLabsStt';
import { normalizeElevenLabsTranscript } from './tools/lib/normalizeElevenLabsTranscript';
import { sanitizeTranscriptWords } from './tools/lib/transcriptSanitize';
import {
  clearTranscriptionProgress,
  readTranscriptionProgress,
  writeTranscriptionProgress,
  type TranscriptionProgress,
} from './tools/lib/transcriptionProgress';
import { getSessionWorkdir } from './tools/lib/utils';
import { dispatchHook } from './hooks/dispatch';

const STILL_PROCESSING_TEXT =
  'Transcription still processing — results arrive automatically; I will update this thread when ready.';

const RESUME_RETRIES = 3;
const RESUME_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export { falSttDeliveryAction } from './falSttIdempotency';

async function downloadJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download Fal STT payload failed: ${res.status}`);
  }
  return res.json();
}

async function persistTranscript(
  userId: string,
  sessionId: string,
  transcriptData: {
    text: string;
    words: { word: string; start: number; end: number }[];
    segments: { start: number; end: number; text: string }[];
    duration_seconds: number;
    language?: string;
  }
): Promise<string> {
  const transcriptPath = getTempPath(`${sessionId}_transcript.json`);
  fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));
  fs.mkdirSync(getSessionWorkdir(sessionId), { recursive: true });
  fs.writeFileSync(
    path.join(getSessionWorkdir(sessionId), 'transcript.json'),
    JSON.stringify(transcriptData, null, 2)
  );
  const storagePath = `users/${userId}/sessions/${sessionId}/transcript.json`;
  const transcriptUrl = await uploadToStorage(transcriptPath, storagePath);
  await writeAssetUrl(userId, sessionId, 'transcript', transcriptUrl);
  return transcriptUrl;
}

async function requireStampedJob(sessionId: string): Promise<PendingFalJob> {
  const job = await readPendingFalJob(sessionId);
  if (!job?.skillId) {
    throw new Error(`pendingFalJob missing skillId stamp for session ${sessionId}`);
  }
  return job;
}

async function runTranscriptHook(
  sessionId: string,
  userId: string,
  pipelineMode: 'ask' | 'auto',
  continueOnly = false
) {
  const job = await requireStampedJob(sessionId);
  if (!continueOnly) {
    return dispatchHook('on_transcript_ready', {
      job,
      sessionId,
      userId,
      pipelineMode,
    });
  }
  let lastErr: unknown;
  for (let attempt = 0; attempt < RESUME_RETRIES; attempt++) {
    try {
      return await dispatchHook('on_transcript_ready', {
        job,
        sessionId,
        userId,
        pipelineMode,
        continueOnly: true,
      });
    } catch (err) {
      lastErr = err;
      if (attempt < RESUME_RETRIES - 1) {
        await sleep(RESUME_BACKOFF_MS * (attempt + 1));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function patchProgress(
  sessionId: string,
  patch: Partial<TranscriptionProgress>
): Promise<void> {
  const current = await readTranscriptionProgress(sessionId);
  if (!current) {
    throw new Error('transcriptionProgress missing during Fal STT delivery');
  }
  await writeTranscriptionProgress(sessionId, { ...current, ...patch });
}

async function sessionHasTranscript(userId: string, sessionId: string): Promise<boolean> {
  const localTranscript = path.join(getSessionWorkdir(sessionId), 'transcript.json');
  if (fs.existsSync(localTranscript)) return true;
  return Boolean(await getAssetUrl(userId, sessionId, 'transcript'));
}

/** Atomic claim: only one hand-off per completed Fal STT. */
export async function claimFalSttWake(
  sessionId: string
): Promise<'claimed' | 'already' | 'incomplete'> {
  return db.runTransaction(async (tx) => {
    const ref = db.collection('sessions').doc(sessionId);
    const snap = await tx.get(ref);
    const progress = snap.data()?.transcriptionProgress as TranscriptionProgress | undefined;
    const decision = resolveWakeClaim(progress ?? null);
    if (decision !== 'claimed') return decision;
    tx.set(
      ref,
      {
        transcriptionProgress: {
          ...progress,
          falSttWakeClaimed: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
    return 'claimed';
  });
}

/**
 * Ask: lecture-heard checkpoint when the skill hook has askPhaseKey; else continue.
 * Auto: assistant text + transcript hook continue (claim already done by caller).
 */
export async function handOffAfterFalStt(opts: {
  sessionId: string;
  userId: string;
  pipelineMode: 'ask' | 'auto';
}): Promise<{ status: 'ask_checkpoint' | 'auto_continued' | 'auto_pending'; message: string }> {
  const { sessionId, userId, pipelineMode } = opts;

  if (pipelineMode === 'ask') {
    try {
      const result = await runTranscriptHook(sessionId, userId, pipelineMode);
      if (result.status === 'ask_checkpoint') {
        await clearPendingFalJob(sessionId);
        const assistantText = result.assistantText;
        await saveMessage(
          sessionId,
          userId,
          'assistant',
          assistantText,
          injectCheckpointPart([{ type: 'text', text: assistantText }], result.checkpointDisplay)
        );
        return {
          status: 'ask_checkpoint',
          message: `fal_stt ask checkpoint for session ${sessionId}`,
        };
      }
      await clearPendingFalJob(sessionId);
      return {
        status: 'auto_continued',
        message: `fal_stt ask continue for session ${sessionId}`,
      };
    } catch (err) {
      console.error(
        '[falStt] checkpoint write failed after transcript durable',
        sessionId,
        err
      );
      throw err;
    }
  }

  const assistantText = 'I understood your lecture.';
  await saveMessage(sessionId, userId, 'assistant', assistantText, [
    { type: 'text', text: assistantText },
  ]);
  await patchProgress(sessionId, { falSttResumePending: true });
  try {
    await runTranscriptHook(sessionId, userId, pipelineMode, true);
    await patchProgress(sessionId, { falSttResumePending: false });
    await clearPendingFalJob(sessionId);
    return {
      status: 'auto_continued',
      message: `fal_stt auto continue for session ${sessionId}`,
    };
  } catch (err) {
    console.error('[falStt] auto continue failed', sessionId, err);
    // Leave pendingFalJob so tryResume can read the skillId stamp.
    return {
      status: 'auto_pending',
      message: `fal_stt auto continue for session ${sessionId}`,
    };
  }
}

async function claimAndHandOff(opts: {
  sessionId: string;
  userId: string;
  pipelineMode: 'ask' | 'auto';
}): Promise<{ status: 'ask_checkpoint' | 'auto_continued' | 'auto_pending' | 'already'; message: string }> {
  const claim = await claimFalSttWake(opts.sessionId);
  if (claim === 'incomplete') {
    return {
      status: 'already',
      message: `fal_stt wake incomplete for session ${opts.sessionId}`,
    };
  }
  if (claim === 'already') {
    return {
      status: 'already',
      message: `fal_stt wake already claimed for session ${opts.sessionId}`,
    };
  }
  return handOffAfterFalStt(opts);
}

/** Shared finalize: normalize payload → transcript.json → claim wake → Ask/Auto hand-off. */
export async function finalizeFalSttFromPayload(opts: {
  sessionId: string;
  userId: string;
  payload: ElevenLabsSttResult;
  progress: TranscriptionProgress;
  requestId?: string;
  pipelineMode: 'ask' | 'auto';
}): Promise<{
  status: 'ask_checkpoint' | 'auto_continued' | 'auto_pending' | 'already';
  message: string;
}> {
  const { sessionId, userId, payload, progress, requestId, pipelineMode } =
    opts;
  const durationSeconds = progress.durationSeconds ?? 0;
  const normalized = normalizeElevenLabsTranscript(payload, durationSeconds);
  const transcriptData = {
    text: normalized.text,
    words: sanitizeTranscriptWords(normalized.words, normalized.duration_seconds),
    segments: normalized.segments,
    duration_seconds: normalized.duration_seconds,
    ...(normalized.language ? { language: normalized.language } : {}),
  };

  await persistTranscript(userId, sessionId, transcriptData);
  await writeTranscriptionProgress(sessionId, {
    videoUrl: progress.videoUrl,
    totalChunks: 1,
    completedChunkIndices: [0],
    status: 'complete',
    falSttFinalizePending: false,
    falSttWebhookPayloadUrl: undefined,
    falSttWakeClaimed: progress.falSttWakeClaimed,
    falSttResumePending: progress.falSttResumePending,
    falSttShortCircuitCount: progress.falSttShortCircuitCount,
    ...(requestId ? { requestId } : {}),
    ...(durationSeconds ? { durationSeconds } : {}),
    ...(normalized.language ? { pinnedLanguage: normalized.language } : {}),
  });

  return claimAndHandOff({ sessionId, userId, pipelineMode });
}

/** Auto-only: entry gate when falSttResumePending after a failed inline resume. */
export async function tryResumeFalSttPending(
  sessionId: string,
  userId: string,
  pipelineMode: 'ask' | 'auto'
): Promise<void> {
  if (pipelineMode !== 'auto') return;
  const progress = await readTranscriptionProgress(sessionId);
  if (!progress?.falSttResumePending) return;
  try {
    await runTranscriptHook(sessionId, userId, pipelineMode, true);
    await patchProgress(sessionId, { falSttResumePending: false });
  } catch (err) {
    console.error('[falStt] entry gate resume failed', sessionId, err);
  }
}

/**
 * Recover when webhook invoke never finalized.
 * Prefers falSttWebhookPayloadUrl; else pulls completed Fal result by requestId.
 * Transcript-exists + unclaimed → claim + hand-off (does not drop wake).
 */
export async function tryRecoverFalSttFinalize(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const progress = await readTranscriptionProgress(sessionId);
  if (!progress) return false;

  const hasTranscript = await sessionHasTranscript(userId, sessionId);

  // Durable transcript + unwoken → clear stale finalize flags, then hand off.
  if (transcriptExistsNeedsWake(progress, hasTranscript)) {
    if (progress.falSttFinalizePending || progress.status === 'in_progress') {
      await patchProgress(sessionId, {
        status: 'complete',
        falSttFinalizePending: false,
        falSttWebhookPayloadUrl: undefined,
      });
    }
    const { pipelineMode } = await getSessionPipelineFields(sessionId);
    await claimAndHandOff({
      sessionId,
      userId,
      pipelineMode,
    });
    return true;
  }

  const payloadUrl = progress.falSttWebhookPayloadUrl;
  const needsFinalize =
    progress.falSttFinalizePending === true ||
    (progress.status === 'in_progress' && Boolean(progress.requestId));

  if (!needsFinalize) return false;
  if (!payloadUrl && !progress.requestId) return false;

  if (hasTranscript) {
    // Woken already; just clear stale pending.
    if (progress.falSttFinalizePending) {
      await patchProgress(sessionId, {
        falSttFinalizePending: false,
        falSttWebhookPayloadUrl: undefined,
      });
    }
    return false;
  }

  if (payloadUrl) {
    try {
      await deliverFalStt(sessionId, userId, {
        taskId: 'fal_stt',
        status: 'completed',
        payloadUrl,
      });
      return true;
    } catch (err) {
      console.error('[falStt] finalize recovery failed', sessionId, err);
      return false;
    }
  }

  // No payload URL (Hosting never wrote fal_stt_*.json) — reconcile from Fal.
  const falKey = process.env.FAL_API_KEY?.trim();
  const requestId = progress.requestId;
  if (!falKey || !requestId) return false;

  try {
    const { status: falStatus } = await falQueueStatus(
      ELEVENLABS_SCRIBE_V2_MODEL,
      requestId,
      falKey
    );
    if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') {
      return false;
    }
    if (falStatus === 'FAILED') {
      const text = 'Transcription failed.';
      await saveMessage(sessionId, userId, 'assistant', text, [{ type: 'text', text }]);
      await clearTranscriptionProgress(sessionId);
      await clearPendingFalJob(sessionId);
      return true;
    }
    if (falStatus !== 'COMPLETED') return false;
    if (!progress.videoUrl) {
      console.error('[falStt] fal reconcile missing videoUrl', sessionId);
      return false;
    }

    const result = await falQueueResult(ELEVENLABS_SCRIBE_V2_MODEL, requestId, falKey);
    const { pipelineMode } = await getSessionPipelineFields(sessionId);
    await finalizeFalSttFromPayload({
      sessionId,
      userId,
      payload: result as ElevenLabsSttResult,
      progress,
      requestId,
      pipelineMode,
    });
    return true;
  } catch (err) {
    console.error('[falStt] fal result recovery failed', sessionId, err);
    return false;
  }
}

/**
 * Entry gate after recover/resume: if transcript still missing and STT pending,
 * do not call the LLM. Escalate to Fal reconcile after age/count thresholds.
 * @returns assistant message text when the invoke should skip runAgent; else null.
 */
export async function tryShortCircuitFalSttPending(
  sessionId: string,
  userId: string
): Promise<string | null> {
  const progress = await readTranscriptionProgress(sessionId);
  const hasTranscript = await sessionHasTranscript(userId, sessionId);
  if (!shouldShortCircuitFalSttEntry(progress, hasTranscript)) return null;
  if (!progress) return null;

  const count = (progress.falSttShortCircuitCount ?? 0) + 1;
  const nowMs = Date.now();
  const escalate = shouldEscalateFalSttShortCircuit({
    updatedAtMs: progressUpdatedAtMs(progress.updatedAt),
    count,
    nowMs,
  });

  async function stillProcessing(): Promise<string> {
    await patchProgress(sessionId, { falSttShortCircuitCount: count });
    await saveMessage(sessionId, userId, 'assistant', STILL_PROCESSING_TEXT, [
      { type: 'text', text: STILL_PROCESSING_TEXT },
    ]);
    return STILL_PROCESSING_TEXT;
  }

  if (!escalate) return stillProcessing();

  const falKey = process.env.FAL_API_KEY?.trim();
  const requestId = progress.requestId;
  if (!falKey || !requestId) return stillProcessing();

  try {
    const { status: falStatus } = await falQueueStatus(
      ELEVENLABS_SCRIBE_V2_MODEL,
      requestId,
      falKey
    );
    if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') {
      // Reset short-circuit window (bump updatedAt via write).
      await patchProgress(sessionId, { falSttShortCircuitCount: 0 });
      await saveMessage(sessionId, userId, 'assistant', STILL_PROCESSING_TEXT, [
        { type: 'text', text: STILL_PROCESSING_TEXT },
      ]);
      return STILL_PROCESSING_TEXT;
    }
    if (falStatus === 'FAILED') {
      const text = 'Transcription failed.';
      await saveMessage(sessionId, userId, 'assistant', text, [{ type: 'text', text }]);
      await clearTranscriptionProgress(sessionId);
      await clearPendingFalJob(sessionId);
      return text;
    }
    if (falStatus === 'COMPLETED' && progress.videoUrl) {
      const result = await falQueueResult(ELEVENLABS_SCRIBE_V2_MODEL, requestId, falKey);
      const { pipelineMode } = await getSessionPipelineFields(sessionId);
      const handoff = await finalizeFalSttFromPayload({
        sessionId,
        userId,
        payload: result as ElevenLabsSttResult,
        progress,
        requestId,
        pipelineMode,
      });
      // Handoff already wrote Ask card / Auto continue — skip LLM with a brief ack.
      return handoff.status === 'ask_checkpoint'
        ? "I've heard your lecture. Ready to continue?"
        : 'I understood your lecture.';
    }

    const text = 'Transcription failed or timed out. Please try again.';
    await saveMessage(sessionId, userId, 'assistant', text, [{ type: 'text', text }]);
    await clearTranscriptionProgress(sessionId);
    await clearPendingFalJob(sessionId);
    return text;
  } catch (err) {
    console.error('[falStt] short-circuit escalate failed', sessionId, err);
    return stillProcessing();
  }
}

export async function deliverFalStt(
  sessionId: string,
  userId: string,
  event: FalEvent
): Promise<string> {
  const pending = await readPendingFalJob(sessionId);
  const progress = await readTranscriptionProgress(sessionId);
  const { pipelineMode } = await getSessionPipelineFields(sessionId);
  const requestId = pending?.requestId ?? progress?.requestId;

  if (event.status === 'failed') {
    const text = `Transcription failed${event.error ? `: ${event.error}` : '.'}`;
    await saveMessage(sessionId, userId, 'assistant', text, [{ type: 'text', text }]);
    await clearTranscriptionProgress(sessionId);
    await clearPendingFalJob(sessionId);
    return `fal_stt failed for session ${sessionId}`;
  }

  const action = falSttDeliveryAction(progress, requestId, pipelineMode);
  if (action === 'noop') {
    await clearPendingFalJob(sessionId);
    if (progress?.falSttFinalizePending) {
      await patchProgress(sessionId, {
        falSttFinalizePending: false,
        falSttWebhookPayloadUrl: undefined,
      });
    }
    return `fal_stt noop for session ${sessionId}`;
  }
  if (action === 'resume_only') {
    try {
      await runTranscriptHook(sessionId, userId, pipelineMode, true);
      await patchProgress(sessionId, { falSttResumePending: false });
    } catch (err) {
      console.error('[falStt] resume-only failed', sessionId, err);
    }
    await clearPendingFalJob(sessionId);
    return `fal_stt resume-only for session ${sessionId}`;
  }
  if (action === 'wake_only') {
    const result = await claimAndHandOff({
      sessionId,
      userId,
      pipelineMode,
    });
    await clearPendingFalJob(sessionId);
    return result.message;
  }

  if (!event.payloadUrl) {
    throw new Error('completed Fal STT event missing payloadUrl');
  }
  if (!progress?.videoUrl) {
    throw new Error('transcriptionProgress missing videoUrl for Fal STT finalize');
  }

  const rawPayload = (await downloadJson(event.payloadUrl)) as ElevenLabsSttResult;
  const result = await finalizeFalSttFromPayload({
    sessionId,
    userId,
    payload: rawPayload,
    progress,
    requestId,
    pipelineMode,
  });
  return result.message;
}
