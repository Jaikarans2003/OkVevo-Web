/**
 * Lazy full-length FLAC for transliteration (Ask english_worded only).
 * Lookup: workdir → Storage → re-extract + upload both.
 * Never called from transcribe_video.
 *
 * FLAC is bound to its source videoUrl via a sidecar (`audio.flac.source_url`)
 * so a new upload in the same session cannot reuse leftover audio.
 *
 * Retention: cached FLACs may accumulate for abandoned sessions — same class
 * as other stale-artifact sweeps; housekeeping is out of scope here.
 */
import fs from 'fs';
import path from 'path';
import { getStorage } from 'firebase-admin/storage';
import { getStorageBucketName } from '../../firebase';
import { uploadFileToStorageKeepLocal } from '../../storage';
import { downloadFile, getSessionWorkdir } from './utils';
import { extractFlac, transcriptionDir, unlinkQuiet } from './audioChunks';
import {
  clearLocalFlac,
  flacMatchesVideo,
  flacSourceUrlLocalPath,
  writeFlacSourceUrl,
} from './flacSourceUrl';

export {
  flacMatchesVideo,
  flacSourceUrlLocalPath,
  mustInvalidateStaleVideo,
  writeFlacSourceUrl,
} from './flacSourceUrl';

export function fullAudioStoragePath(userId: string, sessionId: string): string {
  return `users/${userId}/sessions/${sessionId}/transcription/audio.flac`;
}

export function fullAudioLocalPath(sessionId: string): string {
  return path.join(transcriptionDir(sessionId), 'audio.flac');
}

export function fullAudioSourceUrlStoragePath(userId: string, sessionId: string): string {
  return `${fullAudioStoragePath(userId, sessionId)}.source_url`;
}

async function deleteStorageFileQuiet(storagePath: string): Promise<void> {
  try {
    const bucket = getStorage().bucket(getStorageBucketName());
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
  } catch (err: unknown) {
    console.error(
      '[ensureFullAudio] storage delete failed',
      storagePath,
      err instanceof Error ? err.message.slice(0, 200) : String(err)
    );
  }
}

/** Unlink local FLAC+sidecar and delete Storage copies. */
export async function invalidateFullAudio(
  userId: string,
  sessionId: string
): Promise<void> {
  const local = fullAudioLocalPath(sessionId);
  clearLocalFlac(local);
  await deleteStorageFileQuiet(fullAudioStoragePath(userId, sessionId));
  await deleteStorageFileQuiet(fullAudioSourceUrlStoragePath(userId, sessionId));
}

async function downloadStorageFile(storagePath: string, dest: string): Promise<boolean> {
  try {
    const bucket = getStorage().bucket(getStorageBucketName());
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return false;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await file.download({ destination: dest });
    return fs.existsSync(dest) && fs.statSync(dest).size > 0;
  } catch (err: unknown) {
    console.error(
      '[ensureFullAudio] storage download failed',
      storagePath,
      err instanceof Error ? err.message.slice(0, 200) : String(err)
    );
    return false;
  }
}

/**
 * Ensure `{tmpdir}/okvevo/{sessionId}/transcription/audio.flac` exists.
 * Reuses local/Storage only when sidecar matches videoUrl.
 * On re-extract miss: write workdir + Storage (FLAC + sidecar) before returning.
 */
export async function ensureFullAudio(opts: {
  userId: string;
  sessionId: string;
  videoUrl: string;
}): Promise<string> {
  const local = fullAudioLocalPath(opts.sessionId);
  if (flacMatchesVideo(local, opts.videoUrl)) {
    return local;
  }
  clearLocalFlac(local);

  const storagePath = fullAudioStoragePath(opts.userId, opts.sessionId);
  const sidecarStorage = fullAudioSourceUrlStoragePath(opts.userId, opts.sessionId);
  if (await downloadStorageFile(storagePath, local)) {
    const sidecarLocal = flacSourceUrlLocalPath(local);
    await downloadStorageFile(sidecarStorage, sidecarLocal);
    if (flacMatchesVideo(local, opts.videoUrl)) {
      return local;
    }
    clearLocalFlac(local);
  }

  // Re-extract last resort.
  const workdir = getSessionWorkdir(opts.sessionId);
  const videoPath = path.join(workdir, 'transcription', '_source_video_tmp');
  fs.mkdirSync(path.dirname(videoPath), { recursive: true });
  try {
    await downloadFile(opts.videoUrl, videoPath);
    await extractFlac(videoPath, local);
    if (!fs.existsSync(local) || fs.statSync(local).size <= 0) {
      throw new Error('FLAC extract produced empty file');
    }
    writeFlacSourceUrl(local, opts.videoUrl);
    await uploadFileToStorageKeepLocal(local, storagePath);
    await uploadFileToStorageKeepLocal(flacSourceUrlLocalPath(local), sidecarStorage);
    return local;
  } finally {
    unlinkQuiet(videoPath);
  }
}
