import fs from 'fs';
import os from 'os';
import path from 'path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { db, getStorageBucketName } from './firebase';
import { saveMessage } from './session';
import { FINAL_VIDEO_NAME_RE, nextFinalVideoBasename } from './finalVideoBasename';
import { nextManimClipBasename } from './manimClipBasename';
import { draftMetadataFromRenderSnapshot } from './tools/lib/renderSnapshot';
import { remuxMp4Faststart } from './tools/lib/remuxMp4Faststart';

export { nextFinalVideoBasename } from './finalVideoBasename';
export { nextManimClipBasename } from './manimClipBasename';

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
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.mp3':
      return 'audio/mpeg';
    case '.flac':
      return 'audio/flac';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
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

/** Single-file upload that leaves the local file in place (hf-project edit sync). */
export async function uploadFileToStorageKeepLocal(
  localFilePath: string,
  storagePath: string
): Promise<string> {
  return uploadFileToStorage(localFilePath, storagePath, { deleteLocal: false });
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
    .collection('assets')
    .where('kind', '==', assetKey)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  const url = snap.docs[0]?.data()?.url;
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

export type WriteAssetFields = {
  label?: string;
  mimeType?: string;
  sourceTool?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAssetUrl(
  userId: string,
  sessionId: string,
  kind: string,
  url: string,
  fields?: WriteAssetFields
): Promise<void> {
  await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .add({
      kind,
      url,
      status: 'ready',
      createdAt: FieldValue.serverTimestamp(),
      ...(fields?.label !== undefined ? { label: fields.label } : {}),
      ...(fields?.mimeType !== undefined ? { mimeType: fields.mimeType } : {}),
      ...(fields?.sourceTool !== undefined ? { sourceTool: fields.sourceTool } : {}),
      ...(fields?.metadata !== undefined ? { metadata: fields.metadata } : {}),
    });
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

/** Allocate next free final*.mp4 under the session GCS prefix. */
export async function allocateFinalVideoBasename(
  userId: string,
  sessionId: string
): Promise<string> {
  const bucket = getStorage().bucket(getStorageBucketName());
  const prefix = `users/${userId}/sessions/${sessionId}/`;
  const [files] = await bucket.getFiles({ prefix });
  const names: string[] = [];
  for (const file of files) {
    const name = file.name.slice(prefix.length);
    if (!name || name.includes('/')) continue;
    if (FINAL_VIDEO_NAME_RE.test(name)) names.push(name);
  }
  // In-flight render already reserved a basename on S3 — don't reuse it.
  const session = (await db.collection('sessions').doc(sessionId).get()).data();
  if (
    session?.userId === userId &&
    session.renderStatus === 'RUNNING' &&
    typeof session.renderOutputKey === 'string'
  ) {
    const reserved = path.basename(session.renderOutputKey);
    if (FINAL_VIDEO_NAME_RE.test(reserved)) names.push(reserved);
  }
  return nextFinalVideoBasename(names);
}

/** Allocate next free manim/{safeName}[_N].mp4 — never overwrite a prior version. */
export async function allocateManimClipBasename(
  userId: string,
  sessionId: string,
  safeName: string
): Promise<string> {
  const bucket = getStorage().bucket(getStorageBucketName());
  const prefix = `users/${userId}/sessions/${sessionId}/manim/`;
  const [files] = await bucket.getFiles({ prefix });
  const names: string[] = [];
  for (const file of files) {
    const name = file.name.slice(prefix.length);
    if (!name || name.includes('/')) continue;
    names.push(name);
  }
  return nextManimClipBasename(safeName, names);
}

/** HTTPS URLs already registered on this session's assets subcollection. */
export async function listSessionAssetUrls(
  userId: string,
  sessionId: string
): Promise<string[]> {
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .get();
  const urls: string[] = [];
  for (const doc of snap.docs) {
    const url = doc.data()?.url;
    if (typeof url === 'string' && url) urls.push(url);
  }
  return urls;
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
  tempPath: string,
  preferredBasename?: string
): Promise<string> {
  const sessionRef = db.collection('sessions').doc(sessionId);
  const current = (await sessionRef.get()).data();
  // SUCCEEDED + draftVideoUrl → return existing URL; do not touch renderSnapshot.
  // keep in sync with infrastructure/lambdas/hyperframes-render-completion/index.js
  if (
    current?.userId === userId &&
    current.renderStatus === 'SUCCEEDED' &&
    typeof current.draftVideoUrl === 'string'
  ) {
    return current.draftVideoUrl;
  }

  const basename =
    preferredBasename && FINAL_VIDEO_NAME_RE.test(preferredBasename)
      ? preferredBasename
      : await allocateFinalVideoBasename(userId, sessionId);
  const firebasePath = `users/${userId}/sessions/${sessionId}/${basename}`;
  // ponytail: remux here — completion Lambda has no ffmpeg layer
  await remuxMp4Faststart(tempPath);
  const videoUrl = await uploadToStorage(tempPath, firebasePath);
  // keep in sync with infrastructure/lambdas/hyperframes-render-completion/index.js draft_video metadata
  const metadata = draftMetadataFromRenderSnapshot(
    current?.renderSnapshot as Parameters<typeof draftMetadataFromRenderSnapshot>[0]
  );
  await writeAssetUrl(userId, sessionId, 'draft_video', videoUrl, {
    label: basename,
    mimeType: 'video/mp4',
    ...(metadata ? { metadata } : {}),
  });
  await sessionRef.set(
    {
      renderStatus: 'SUCCEEDED',
      renderError: FieldValue.delete(),
      draftVideoUrl: videoUrl,
      pipelinePhase: 7,
      pipelineStatus: 'complete',
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
      // First success only: clear stash so a later scaffold does not attach to this draft.
      renderSnapshot: FieldValue.delete(),
    },
    { merge: true }
  );

  // Surface the finished video in chat — webhook/Check Now used to only write
  // Firestore fields, so the UI never got an assistant message with the player.
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
    return await finalizeRenderFromLocalFile(
      userId,
      sessionId,
      tempPath,
      path.basename(outputKey)
    );
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

/** Unique GCS filename per Fal gen so storage URLs never collide. */
export function backgroundAssetIdentity(
  kind: 'fal_image' | 'fal_video',
  entryId: string
): {
  assetKind: 'background_image' | 'background_video';
  filename: string;
  label: string;
} {
  const isImage = kind === 'fal_image';
  return {
    assetKind: isImage ? 'background_image' : 'background_video',
    filename: isImage ? `background-${entryId}.png` : `background-${entryId}.mp4`,
    label: isImage ? `Background Image ${entryId}` : `Background Video ${entryId}`,
  };
}

/** Download Fal media → Firebase background asset → chat message (non-LLM webhook). */
export async function finalizeBackgroundFromUrl(
  userId: string,
  sessionId: string,
  kind: 'fal_image' | 'fal_video',
  mediaUrl: string
): Promise<string> {
  const isImage = kind === 'fal_image';
  const ext = isImage ? 'png' : 'mp4';
  // ponytail: unique GCS filenames; Firestore autoId + kind field = gallery history.
  const entryId = crypto.randomUUID().slice(0, 8);
  const { assetKind, filename, label } = backgroundAssetIdentity(kind, entryId);
  const tempPath = getTempPath(`fal-${sessionId}-${entryId}.${ext}`);

  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${mediaUrl}`);
  }
  fs.writeFileSync(tempPath, Buffer.from(await response.arrayBuffer()));
  try {
    const storagePath = `users/${userId}/sessions/${sessionId}/${filename}`;
    const publicUrl = await uploadToStorage(tempPath, storagePath);
    await writeAssetUrl(userId, sessionId, assetKind, publicUrl, {
      label,
      mimeType: isImage ? 'image/png' : 'video/mp4',
      sourceTool: 'fal',
    });

    const text = isImage
      ? 'Your background image is ready.'
      : 'Your background video is ready.';
    try {
      await saveMessage(
        sessionId,
        userId,
        'assistant',
        text,
        [{ type: 'text', text }],
        isImage ? { imageUrl: publicUrl } : { videoUrl: publicUrl }
      );
    } catch (err) {
      console.error('[finalize] failed to post fal background chat message:', err);
    }
    return publicUrl;
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

export function selfcheckBackgroundIdentity(): void {
  const a = backgroundAssetIdentity('fal_image', 'abc12def');
  const b = backgroundAssetIdentity('fal_image', 'xyz99zzz');
  if (a.filename === b.filename) {
    throw new Error('background identity must be unique per entryId');
  }
  if (a.filename !== 'background-abc12def.png' || a.assetKind !== 'background_image') {
    throw new Error(`unexpected image identity ${a.filename}/${a.assetKind}`);
  }
  const v = backgroundAssetIdentity('fal_video', 'abc12def');
  if (v.assetKind !== 'background_video' || v.filename !== 'background-abc12def.mp4') {
    throw new Error('fal_video identity mismatch');
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
