/**
 * Lazy full-length FLAC for transliteration (Ask english_worded only).
 * Lookup: workdir → Storage → re-extract + upload both.
 * Never called from transcribe_video.
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

export function fullAudioStoragePath(userId: string, sessionId: string): string {
  return `users/${userId}/sessions/${sessionId}/transcription/audio.flac`;
}

export function fullAudioLocalPath(sessionId: string): string {
  return path.join(transcriptionDir(sessionId), 'audio.flac');
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
 * On re-extract miss: write workdir + Storage before returning.
 */
export async function ensureFullAudio(opts: {
  userId: string;
  sessionId: string;
  videoUrl: string;
}): Promise<string> {
  const local = fullAudioLocalPath(opts.sessionId);
  if (fs.existsSync(local) && fs.statSync(local).size > 0) {
    return local;
  }

  const storagePath = fullAudioStoragePath(opts.userId, opts.sessionId);
  if (await downloadStorageFile(storagePath, local)) {
    return local;
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
    await uploadFileToStorageKeepLocal(local, storagePath);
    return local;
  } finally {
    unlinkQuiet(videoPath);
  }
}
