import fs from 'fs';
import os from 'os';
import path from 'path';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { db, getStorageBucketName } from './firebase';

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
