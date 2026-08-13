/**
 * One-off: remux session MP4s with faststart (+ optional duration trim).
 *
 * Usage (from services/agent, with Firebase env loaded):
 *   npx ts-node scripts/remux-session-videos.ts <sessionId> [--trim]
 *
 * --trim: if format.duration ≫ last transcript word + 10s, copy-remux with -t.
 */
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getStorage } from 'firebase-admin/storage';
import { db, getStorageBucketName } from '../src/firebase';
import { parseStoragePathFromPublicUrl, uploadFileToStorageKeepLocal } from '../src/storage';
import { remuxMp4Faststart } from '../src/tools/lib/remuxMp4Faststart';
import { resolveCompositionDuration } from '../src/tools/lib/resolveCompositionDuration';
import { execCommand } from '../src/tools/lib/utils';
import { isRenderedManimClipKind } from '../src/tools/lib/sessionManimClips';

async function probeDuration(mediaPath: string): Promise<number> {
  const probe = await execCommand(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${mediaPath}"`,
    { timeoutSeconds: 60 }
  );
  if (!probe.success) throw new Error(probe.stderr || 'ffprobe failed');
  return Number.parseFloat(probe.stdout.trim()) || 0;
}

async function lastTranscriptWordEnd(
  userId: string,
  sessionId: string
): Promise<number> {
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .where('kind', '==', 'transcript')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  const url = snap.docs[0]?.data()?.url;
  if (typeof url !== 'string' || !url) return 0;
  const res = await fetch(url);
  if (!res.ok) return 0;
  const data = (await res.json()) as { words?: { end?: number }[] };
  const words = Array.isArray(data.words) ? data.words : [];
  if (!words.length) return 0;
  const end = words[words.length - 1]?.end;
  return typeof end === 'number' && end > 0 ? end : 0;
}

function isSessionVideoKind(kind: unknown): boolean {
  if (typeof kind !== 'string') return false;
  if (kind === 'draft_video' || kind === 'final_video') return true;
  return isRenderedManimClipKind(kind);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--trim');
  const doTrim = process.argv.includes('--trim');
  const sessionId = args[0];
  if (!sessionId) {
    console.error('Usage: remux-session-videos.ts <sessionId> [--trim]');
    process.exit(1);
  }

  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  if (!sessionSnap.exists) throw new Error(`Session not found: ${sessionId}`);
  const userId = sessionSnap.data()?.userId;
  if (typeof userId !== 'string' || !userId) {
    throw new Error(`Session ${sessionId} has no userId`);
  }

  const assetsSnap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .get();

  // Latest URL per storage path (dedupe versions).
  type Entry = { kind: string; url: string; t: number };
  const byPath = new Map<string, Entry>();
  for (const doc of assetsSnap.docs) {
    const data = doc.data();
    if (!isSessionVideoKind(data.kind)) continue;
    const url = data.url;
    if (typeof url !== 'string' || !url.toLowerCase().includes('.mp4')) continue;
    let storagePath: string;
    try {
      storagePath = parseStoragePathFromPublicUrl(url);
    } catch {
      continue;
    }
    const createdAt = data.createdAt as { toMillis?: () => number } | undefined;
    const t =
      createdAt && typeof createdAt.toMillis === 'function' ? createdAt.toMillis() : 0;
    const prev = byPath.get(storagePath);
    if (!prev || t >= prev.t) {
      byPath.set(storagePath, { kind: String(data.kind), url, t });
    }
  }

  // Also include session.draftVideoUrl if not already listed.
  const draftUrl = sessionSnap.data()?.draftVideoUrl;
  if (typeof draftUrl === 'string' && draftUrl.toLowerCase().includes('.mp4')) {
    try {
      const storagePath = parseStoragePathFromPublicUrl(draftUrl);
      if (!byPath.has(storagePath)) {
        byPath.set(storagePath, { kind: 'draft_video', url: draftUrl, t: 0 });
      }
    } catch {
      // ignore
    }
  }

  const lastWordEnd = doTrim ? await lastTranscriptWordEnd(userId, sessionId) : 0;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'okvevo-remux-'));
  console.log(
    JSON.stringify({
      sessionId,
      userId,
      videos: byPath.size,
      trim: doTrim,
      lastWordEnd,
    })
  );

  try {
    for (const [storagePath, entry] of byPath) {
      const local = path.join(work, path.basename(storagePath));
      const bucket = getStorage().bucket(getStorageBucketName());
      await bucket.file(storagePath).download({ destination: local });
      const before = await probeDuration(local);

      let trimTo: number | null = null;
      if (doTrim && (entry.kind === 'draft_video' || entry.kind === 'final_video')) {
        const resolved = resolveCompositionDuration({
          lastWordEnd,
          transcriptDuration: before,
          audioProbe: before,
          videoProbe: before,
        });
        if (before > resolved + 0.05) trimTo = resolved;
      }

      if (trimTo != null) {
        const tmp = `${local}.trim.mp4`;
        const trim = await execCommand(
          `ffmpeg -y -i "${local}" -t ${trimTo} -c copy -movflags +faststart "${tmp}"`,
          { timeoutSeconds: 180 }
        );
        if (!trim.success) {
          fs.rmSync(tmp, { force: true });
          throw new Error(trim.stderr || `trim failed: ${storagePath}`);
        }
        fs.renameSync(tmp, local);
      } else {
        await remuxMp4Faststart(local);
      }

      const after = await probeDuration(local);
      const url = await uploadFileToStorageKeepLocal(local, storagePath);
      console.log(
        JSON.stringify({
          kind: entry.kind,
          storagePath,
          before,
          after,
          trimmed: trimTo,
          url,
        })
      );
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
