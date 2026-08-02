import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { FieldValue, Timestamp, type CollectionReference } from 'firebase-admin/firestore';

const execFileAsync = promisify(execFile);

/** Purge accepts matching exportToken if issued within this window. */
export const EXPORT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function sessionStoragePrefix(userId: string, sessionId: string): string {
  return `users/${userId}/sessions/${sessionId}/`;
}

export function sessionUploadPrefix(userId: string, sessionId: string): string {
  return `uploads/${userId}/${sessionId}/`;
}

export function isExportTokenFresh(
  exportTokenAt: unknown,
  nowMs = Date.now()
): boolean {
  const atMs =
    exportTokenAt instanceof Timestamp
      ? exportTokenAt.toMillis()
      : typeof exportTokenAt === 'number'
        ? exportTokenAt
        : exportTokenAt instanceof Date
          ? exportTokenAt.getTime()
          : null;
  if (atMs == null || !Number.isFinite(atMs)) return false;
  return nowMs - atMs < EXPORT_TOKEN_TTL_MS;
}

function jsonSafe(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = jsonSafe(v);
    }
    return out;
  }
  return value;
}

async function downloadStoragePrefixToDir(
  storagePrefix: string,
  localDir: string
): Promise<number> {
  const { getAdminBucket } = await import('@/lib/firebase-admin');
  const bucket = getAdminBucket();
  const prefix = storagePrefix.endsWith('/') ? storagePrefix : `${storagePrefix}/`;
  const [files] = await bucket.getFiles({ prefix });
  let count = 0;
  for (const file of files) {
    if (file.name.endsWith('/')) continue;
    const relative = file.name.slice(prefix.length);
    if (!relative) continue;
    const dest = path.join(localDir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await file.download({ destination: dest });
    count += 1;
  }
  return count;
}

/** Zip a directory tree (Python zipfile — no new npm dep). No index.html requirement. */
export async function zipDirectory(
  sourceDir: string,
  zipPath: string
): Promise<void> {
  fs.rmSync(zipPath, { force: true });
  const pyPath = `${zipPath}.py`;
  const script = [
    'import os, sys, zipfile',
    'src, dst = sys.argv[1], sys.argv[2]',
    'with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zf:',
    '    for root, dirs, files in os.walk(src):',
    '        dirs[:] = [d for d in dirs if not d.startswith(".")]',
    '        for name in files:',
    '            if name.startswith("."):',
    '                continue',
    '            abs_path = os.path.join(root, name)',
    '            rel = os.path.relpath(abs_path, src).replace(os.sep, "/")',
    '            zf.write(abs_path, rel)',
    '',
  ].join('\n');
  fs.writeFileSync(pyPath, script);
  try {
    await execFileAsync('python3', [pyPath, sourceDir, zipPath], {
      timeout: 300_000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } finally {
    fs.rmSync(pyPath, { force: true });
  }
  if (!fs.existsSync(zipPath)) {
    throw new Error('Failed to create session export zip');
  }
}

async function writeFirestoreExport(
  userId: string,
  sessionId: string,
  outDir: string
): Promise<void> {
  const { db } = await import('@/lib/firebase-admin');
  fs.mkdirSync(outDir, { recursive: true });

  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  fs.writeFileSync(
    path.join(outDir, 'session.json'),
    JSON.stringify(
      { id: sessionId, ...(jsonSafe(sessionSnap.data() ?? {}) as object) },
      null,
      2
    )
  );

  const messagesSnap = await db
    .collection('sessions')
    .doc(sessionId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .get();
  const messages = messagesSnap.docs.map((doc) => ({
    id: doc.id,
    ...(jsonSafe(doc.data()) as object),
  }));
  fs.writeFileSync(
    path.join(outDir, 'messages.json'),
    JSON.stringify(messages, null, 2)
  );

  const assetsSnap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .get();
  const assets = assetsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(jsonSafe(doc.data()) as object),
  }));
  fs.writeFileSync(
    path.join(outDir, 'assets.json'),
    JSON.stringify(assets, null, 2)
  );

  const planSnap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('hf_segments')
    .doc('plan')
    .get();
  if (planSnap.exists) {
    fs.writeFileSync(
      path.join(outDir, 'hf_segments_plan.json'),
      JSON.stringify(
        { id: planSnap.id, ...(jsonSafe(planSnap.data()) as object) },
        null,
        2
      )
    );
  }
}

export type SessionBundleResult = {
  zipPath: string;
  cleanup: () => void;
  fileCounts: { sessionStorage: number; uploads: number };
};

/**
 * Download both GCS prefixes + Firestore JSON into a temp zip.
 * Caller streams then must call cleanup().
 */
export async function exportSessionBundle(
  userId: string,
  sessionId: string
): Promise<SessionBundleResult> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `okvevo-export-${sessionId}-`));
  const staging = path.join(root, 'bundle');
  fs.mkdirSync(staging, { recursive: true });

  const sessionLocal = path.join(
    staging,
    'storage',
    'users',
    userId,
    'sessions',
    sessionId
  );
  const uploadsLocal = path.join(staging, 'uploads', userId, sessionId);
  fs.mkdirSync(sessionLocal, { recursive: true });
  fs.mkdirSync(uploadsLocal, { recursive: true });

  const sessionStorage = await downloadStoragePrefixToDir(
    sessionStoragePrefix(userId, sessionId),
    sessionLocal
  );
  const uploads = await downloadStoragePrefixToDir(
    sessionUploadPrefix(userId, sessionId),
    uploadsLocal
  );

  await writeFirestoreExport(
    userId,
    sessionId,
    path.join(staging, 'firestore-export')
  );

  const zipPath = path.join(root, `session-${sessionId}.zip`);
  await zipDirectory(staging, zipPath);

  return {
    zipPath,
    cleanup: () => {
      fs.rmSync(root, { recursive: true, force: true });
    },
    fileCounts: { sessionStorage, uploads },
  };
}

export function mintExportToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export async function persistExportToken(
  sessionId: string,
  exportToken: string
): Promise<void> {
  const { db } = await import('@/lib/firebase-admin');
  await db.collection('sessions').doc(sessionId).set(
    {
      exportToken,
      exportTokenAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export function s3RenderPrefix(userId: string, sessionId: string): string {
  return `renders/users/${userId}/sessions/${sessionId}/`;
}

/** Returns error string if purge body/token invalid; null if ok. */
export function validatePurgeRequest(
  body: { confirm?: unknown; exportToken?: unknown },
  stored: { exportToken?: unknown; exportTokenAt?: unknown }
): string | null {
  if (body.confirm !== true) return 'confirm must be true';
  if (typeof body.exportToken !== 'string' || !body.exportToken) {
    return 'exportToken is required';
  }
  if (
    typeof stored.exportToken !== 'string' ||
    stored.exportToken !== body.exportToken
  ) {
    return 'exportToken mismatch — download the project again first';
  }
  if (!isExportTokenFresh(stored.exportTokenAt)) {
    return 'exportToken expired — download the project again';
  }
  return null;
}

async function deleteCollectionByRef(
  // ponytail: Firestore batch cap 500 — loop until empty
  col: CollectionReference
): Promise<number> {
  const { db } = await import('@/lib/firebase-admin');
  let deleted = 0;
  for (;;) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      deleted += 1;
    }
    await batch.commit();
  }
  return deleted;
}

async function deleteS3RenderPrefix(
  userId: string,
  sessionId: string
): Promise<void> {
  const bucket = process.env.HYPERFRAMES_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  if (!bucket || !region) {
    console.log(
      `[purge] S3 render cleanup skipped session=${sessionId} reason=missing HYPERFRAMES_BUCKET or AWS_REGION`
    );
    return;
  }

  try {
    const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } =
      await import('@aws-sdk/client-s3');
    const client = new S3Client({ region });
    const prefix = s3RenderPrefix(userId, sessionId);
    let deleted = 0;
    let token: string | undefined;
    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        })
      );
      const keys = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k));
      if (keys.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: keys.map((Key) => ({ Key })),
              Quiet: true,
            },
          })
        );
        deleted += keys.length;
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
    console.log(
      `[purge] S3 render cleanup ok session=${sessionId} deleted=${deleted}`
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.log(
      `[purge] S3 render cleanup failed session=${sessionId} reason=${reason}`
    );
  }
}

/**
 * Irreversible wipe: both GCS prefixes, Firestore session tree, best-effort S3, local tmp.
 */
export async function deleteSessionPermanently(
  userId: string,
  sessionId: string
): Promise<void> {
  const { db, getAdminBucket } = await import('@/lib/firebase-admin');
  const bucket = getAdminBucket();

  await Promise.all([
    bucket.deleteFiles({ prefix: sessionStoragePrefix(userId, sessionId) }),
    bucket.deleteFiles({ prefix: sessionUploadPrefix(userId, sessionId) }),
  ]);

  await deleteS3RenderPrefix(userId, sessionId);

  const sessionRef = db.collection('sessions').doc(sessionId);
  await deleteCollectionByRef(sessionRef.collection('messages'));

  const userSessionRef = db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId);
  await deleteCollectionByRef(userSessionRef.collection('assets'));
  await userSessionRef
    .collection('hf_segments')
    .doc('plan')
    .delete()
    .catch(() => undefined);
  await userSessionRef.delete().catch(() => undefined);

  await sessionRef.delete();

  const workdir = path.join(os.tmpdir(), 'okvevo', sessionId);
  fs.rmSync(workdir, { recursive: true, force: true });
}
