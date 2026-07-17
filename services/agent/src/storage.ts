import fs from 'fs';
import os from 'os';
import path from 'path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { db, getStorageBucketName } from './firebase';
import { saveMessage } from './session';

export type HfSegmentsPlan = {
  segments: unknown[];
  total_duration: number;
  updatedAt?: unknown;
};

function getPublicUrl(bucketName: string, storagePath: string): string {
  return `https://storage.googleapis.com/${bucketName}/${storagePath}`;
}

export function getTempPath(filename: string): string {
  return path.join(os.tmpdir(), filename);
}

export function walkDir(dir: string): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.json':
      return 'application/json';
    case '.html':
      return 'text/html';
    case '.mp4':
      return 'video/mp4';
    case '.mp3':
      return 'audio/mpeg';
    case '.css':
      return 'text/css';
    case '.js':
      return 'application/javascript';
    case '.py':
      return 'text/x-python';
    default:
      return 'application/octet-stream';
  }
}

async function uploadFileToStorage(
  localFilePath: string,
  storagePath: string,
  options: { deleteLocal?: boolean } = {}
): Promise<string> {
  const bucket = getStorage().bucket(getStorageBucketName());
  const fileRef = bucket.file(storagePath);

  await fileRef.save(fs.readFileSync(localFilePath), {
    resumable: false,
    metadata: {
      contentType: contentTypeForPath(localFilePath),
    },
  });
  await fileRef.makePublic();

  const url = getPublicUrl(fileRef.bucket.name, storagePath);

  if (options.deleteLocal !== false) {
    try {
      fs.unlinkSync(localFilePath);
    } catch {
      // temp file may already be gone
    }
  }

  return url;
}

export async function uploadToStorage(
  localFilePath: string,
  storagePath: string
): Promise<string> {
  return uploadFileToStorage(localFilePath, storagePath, { deleteLocal: true });
}

export async function uploadDirectoryToStorage(
  localDir: string,
  storagePrefix: string
): Promise<{ indexUrl: string; prefixUrl: string }> {
  const bucket = getStorage().bucket(getStorageBucketName());
  const prefixUrl = getPublicUrl(bucket.name, storagePrefix);
  let indexUrl = '';

  for (const filePath of walkDir(localDir)) {
    const relative = path.relative(localDir, filePath).replace(/\\/g, '/');
    const storagePath = `${storagePrefix}/${relative}`;
    const url = await uploadFileToStorage(filePath, storagePath, { deleteLocal: false });

    if (relative === 'index.html') {
      indexUrl = url;
    }
  }

  if (!indexUrl) {
    indexUrl = getPublicUrl(bucket.name, `${storagePrefix}/index.html`);
  }

  return { indexUrl, prefixUrl };
}

export async function getAssetUrl(
  userId: string,
  sessionId: string,
  assetKey: string
): Promise<string | null> {
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .get();
  const url = snap.data()?.assets?.[assetKey];
  return typeof url === 'string' && url.length > 0 ? url : null;
}

export function parseStoragePathFromPublicUrl(url: string): string {
  const parsed = new URL(url);
  const segments = parsed.pathname.replace(/^\//, '').split('/');
  return segments.slice(1).join('/');
}

export async function downloadStoragePrefixToDir(
  storagePrefix: string,
  localDir: string
): Promise<void> {
  const bucket = getStorage().bucket(getStorageBucketName());
  const prefix = storagePrefix.endsWith('/') ? storagePrefix : `${storagePrefix}/`;
  const [files] = await bucket.getFiles({ prefix });

  for (const file of files) {
    if (file.name.endsWith('/')) continue;
    const relative = file.name.slice(prefix.length);
    if (!relative) continue;
    const dest = path.join(localDir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await file.download({ destination: dest });
  }
}

export async function writeAssetUrl(
  userId: string,
  sessionId: string,
  assetKey: string,
  url: string
): Promise<void> {
  await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .set(
      {
        assets: {
          [assetKey]: url,
        },
      },
      { merge: true }
    );
}

export async function writeHfSegmentsPlan(
  userId: string,
  sessionId: string,
  plan: { segments: unknown[]; total_duration: number }
): Promise<void> {
  await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('hf_segments')
    .doc('plan')
    .set({ ...plan, updatedAt: FieldValue.serverTimestamp() });
}

export async function getHfSegmentsPlan(
  userId: string,
  sessionId: string
): Promise<HfSegmentsPlan | null> {
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('hf_segments')
    .doc('plan')
    .get();
  return snap.exists ? (snap.data() as HfSegmentsPlan) : null;
}

export type RenderJob = {
  executionArn: string;
  outputKey: string;
  renderStatus: string;
  compositionUrl?: string;
};

export async function persistRenderJob(
  userId: string,
  sessionId: string,
  job: Omit<RenderJob, 'renderStatus'>
): Promise<RenderJob> {
  const payload = {
    renderExecutionArn: job.executionArn,
    renderOutputKey: job.outputKey,
    renderStatus: 'RUNNING',
    renderCompositionUrl: job.compositionUrl,
    pipelinePhase: 6,
    pipelineStatus: 'rendering',
    pipelineUpdatedAt: FieldValue.serverTimestamp(),
  };
  await db.collection('sessions').doc(sessionId).set({ userId, ...payload }, { merge: true });
  return { ...job, renderStatus: 'RUNNING' };
}

export async function getRenderJob(
  userId: string,
  sessionId: string
): Promise<RenderJob | null> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  const data = snap.data();
  if (!snap.exists || data?.userId !== userId) return null;
  if (typeof data.renderExecutionArn !== 'string' || typeof data.renderOutputKey !== 'string') {
    return null;
  }
  return {
    executionArn: data.renderExecutionArn,
    outputKey: data.renderOutputKey,
    renderStatus: typeof data.renderStatus === 'string' ? data.renderStatus : 'RUNNING',
    compositionUrl:
      typeof data.renderCompositionUrl === 'string' ? data.renderCompositionUrl : undefined,
  };
}

export async function finalizeRenderFromLocalFile(
  userId: string,
  sessionId: string,
  tempPath: string
): Promise<string> {
  const sessionRef = db.collection('sessions').doc(sessionId);
  const current = (await sessionRef.get()).data();
  if (
    current?.userId === userId &&
    current.renderStatus === 'SUCCEEDED' &&
    typeof current.draftVideoUrl === 'string'
  ) {
    return current.draftVideoUrl;
  }

  const firebasePath = `users/${userId}/sessions/${sessionId}/draft_video.mp4`;
  const videoUrl = await uploadToStorage(tempPath, firebasePath);
  await writeAssetUrl(userId, sessionId, 'draft_video', videoUrl);
  await sessionRef.set(
    {
      assets: { draft_video: videoUrl },
      renderStatus: 'SUCCEEDED',
      renderError: FieldValue.delete(),
      draftVideoUrl: videoUrl,
      pipelinePhase: 7,
      pipelineStatus: 'complete',
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Surface the URL in chat — webhook/Check Now used to only write Firestore fields,
  // so the UI never got an assistant message with the finished video.
  try {
    const text = 'Your educational video is ready.';
    await saveMessage(sessionId, userId, 'assistant', text, [
      { type: 'text', text },
    ], { videoUrl });
  } catch (err) {
    console.error('[finalize] failed to post draft video chat message:', err);
  }

  return videoUrl;
}

export async function finalizeRenderFromUrl(
  userId: string,
  sessionId: string,
  videoUrl: string
): Promise<string> {
  const sessionRef = db.collection('sessions').doc(sessionId);
  const current = (await sessionRef.get()).data();
  if (
    current?.userId === userId &&
    current.renderStatus === 'SUCCEEDED' &&
    typeof current.draftVideoUrl === 'string'
  ) {
    return current.draftVideoUrl;
  }

  const tempPath = getTempPath(`hyperframes-${sessionId}.mp4`);
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${videoUrl}`);
  }
  fs.writeFileSync(tempPath, Buffer.from(await response.arrayBuffer()));
  try {
    return await finalizeRenderFromLocalFile(userId, sessionId, tempPath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

export async function finalizeRenderFromS3(
  userId: string,
  sessionId: string,
  bucketName: string,
  outputKey: string,
  region?: string
): Promise<string> {
  const sessionRef = db.collection('sessions').doc(sessionId);
  const current = (await sessionRef.get()).data();
  if (
    current?.userId === userId &&
    current.renderStatus === 'SUCCEEDED' &&
    typeof current.draftVideoUrl === 'string'
  ) {
    return current.draftVideoUrl;
  }

  const response = await new S3Client({ region }).send(
    new GetObjectCommand({ Bucket: bucketName, Key: outputKey })
  );
  if (!response.Body) throw new Error('Render output is missing from S3');

  const tempPath = getTempPath(`hyperframes-${sessionId}.mp4`);
  fs.writeFileSync(tempPath, Buffer.from(await response.Body.transformToByteArray()));
  try {
    return await finalizeRenderFromLocalFile(userId, sessionId, tempPath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

export async function recordRenderFailure(
  userId: string,
  sessionId: string,
  status: 'FAILED' | 'TIMED_OUT' | 'ABORTED',
  error: string
): Promise<void> {
  await db.collection('sessions').doc(sessionId).set(
    {
      userId,
      renderStatus: status,
      renderError: error,
      pipelineStatus: 'failed',
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/** Create-once dedup for HeyGen webhook deliveries. Returns false if already claimed. */
export async function claimHeygenEvent(eventId: string): Promise<boolean> {
  try {
    await db.collection('heygen_webhook_events').doc(eventId).create({
      receivedAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}
