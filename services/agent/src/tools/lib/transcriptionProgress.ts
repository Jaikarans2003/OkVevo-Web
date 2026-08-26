import fs from 'fs';
import path from 'path';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { db, getStorageBucketName } from '../../firebase';
import { uploadFileToStorageKeepLocal, writeAssetUrl } from '../../storage';
import type { ChunkTranscript } from './transcriptStitch';
import { transcriptionDir, validateLocalChunkMeta } from './audioChunks';

export type TranscriptionProgressStatus =
  | 'in_progress'
  | 'awaiting_user'
  | 'complete'
  | 'aborted';

export type TranscriptionProgress = {
  videoUrl: string;
  totalChunks: number;
  completedChunkIndices: number[];
  failedChunk?: {
    index: number;
    startOffsetSeconds: number;
    durationSeconds: number;
    reason: string;
  };
  status: TranscriptionProgressStatus;
  checkpointId?: string;
  gaps?: { index: number; startOffsetSeconds: number; durationSeconds: number }[];
  /** Language detected on first successful chunk; pinned for later chunks. */
  pinnedLanguage?: string;
  /** Fal Scribe v2 queue request id (auto-detect path). */
  requestId?: string;
  /** Probed audio duration before queue submit. */
  durationSeconds?: number;
  /** Auto mode: inline runAgent resume failed; entry gate retries on next invoke. */
  falSttResumePending?: boolean;
  /** Finalize never completed (distinct from falSttResumePending). */
  falSttFinalizePending?: boolean;
  /** Stored webhook payload URL when invoke failed after upload — entry-gate recovery. */
  falSttWebhookPayloadUrl?: string;
  /** Ask checkpoint / Auto continue already claimed — prevents double hand-off. */
  falSttWakeClaimed?: boolean;
  /** Entry-gate short-circuit hits while transcript still missing. */
  falSttShortCircuitCount?: number;
  updatedAt?: unknown;
};

export function parseTranscriptionProgress(raw: unknown): TranscriptionProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as TranscriptionProgress;
  if (typeof p.videoUrl !== 'string' || !Array.isArray(p.completedChunkIndices)) {
    return null;
  }
  return p;
}

export async function readTranscriptionProgress(
  sessionId: string
): Promise<TranscriptionProgress | null> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  return parseTranscriptionProgress(snap.data()?.transcriptionProgress);
}

export async function writeTranscriptionProgress(
  sessionId: string,
  progress: TranscriptionProgress
): Promise<void> {
  await db
    .collection('sessions')
    .doc(sessionId)
    .set(
      {
        transcriptionProgress: {
          ...progress,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
}

export async function clearTranscriptionProgress(sessionId: string): Promise<void> {
  await db
    .collection('sessions')
    .doc(sessionId)
    .set({ transcriptionProgress: FieldValue.delete() }, { merge: true });
}

export function chunkStoragePath(
  userId: string,
  sessionId: string,
  index: number
): string {
  return `users/${userId}/sessions/${sessionId}/transcription_chunks/chunk-${index}.json`;
}

export async function persistChunkResult(
  userId: string,
  sessionId: string,
  chunk: ChunkTranscript & { index: number }
): Promise<string> {
  const payload: ChunkTranscript = {
    words: chunk.words,
    segments: chunk.segments,
    text: chunk.text,
    startOffsetSeconds: chunk.startOffsetSeconds,
    durationSeconds: chunk.durationSeconds,
    ...(chunk.language !== undefined ? { language: chunk.language } : {}),
    ...(chunk.provider !== undefined ? { provider: chunk.provider } : {}),
    ...(chunk.skipped ? { skipped: true } : {}),
  };

  const localPath = path.join(transcriptionDir(sessionId), `chunk-${chunk.index}.json`);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(payload, null, 2));

  const storagePath = chunkStoragePath(userId, sessionId, chunk.index);
  const url = await uploadFileToStorageKeepLocal(localPath, storagePath);
  await writeAssetUrl(userId, sessionId, 'transcription_chunk', url, {
    sourceTool: 'transcribe_video',
    metadata: {
      index: chunk.index,
      startOffsetSeconds: chunk.startOffsetSeconds,
      durationSeconds: chunk.durationSeconds,
    },
  });
  return url;
}

export async function loadChunkResult(
  userId: string,
  sessionId: string,
  index: number,
  expected: { startOffsetSeconds: number; durationSeconds: number }
): Promise<ChunkTranscript | null> {
  const localPath = path.join(transcriptionDir(sessionId), `chunk-${index}.json`);
  if (fs.existsSync(localPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(localPath, 'utf-8')) as ChunkTranscript;
      if (
        validateLocalChunkMeta(
          {
            startOffsetSeconds: parsed.startOffsetSeconds,
            durationSeconds: parsed.durationSeconds,
          },
          expected
        )
      ) {
        return parsed;
      }
    } catch {
      // fall through to Storage
    }
  }

  try {
    const bucket = getStorage().bucket(getStorageBucketName());
    const file = bucket.file(chunkStoragePath(userId, sessionId, index));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    const parsed = JSON.parse(buf.toString('utf-8')) as ChunkTranscript;
    if (
      !validateLocalChunkMeta(
        {
          startOffsetSeconds: parsed.startOffsetSeconds,
          durationSeconds: parsed.durationSeconds,
        },
        expected
      )
    ) {
      return null;
    }
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(parsed, null, 2));
    return parsed;
  } catch {
    return null;
  }
}

export async function deleteTranscriptionChunkObjects(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    const bucket = getStorage().bucket(getStorageBucketName());
    await bucket.deleteFiles({
      prefix: `users/${userId}/sessions/${sessionId}/transcription_chunks/`,
    });
  } catch (err) {
    console.error('[transcribe_video] chunk cleanup', sessionId, err);
  }
}
