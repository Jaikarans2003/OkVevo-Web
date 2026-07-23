import path from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';

const SOURCE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.mjs',
  '.py',
  '.ts',
  '.tsx',
]);

export function assetLabel(kind: string): string {
  return kind
    .replace(/^uploaded_video_/, '')
    .replace(/^manim_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function assetType(kind: string, url: string): string {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if (['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) return 'audio';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return 'image';
  if (kind === 'transcript') return 'transcript';
  if (['.json', '.csv', '.txt', '.srt', '.vtt'].includes(ext)) return 'data';
  return 'file';
}

export function isTaggableAsset(kind: string, url: string): boolean {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname);
    const ext = path.extname(pathname).toLowerCase();
    const lastSegment = pathname.split('/').filter(Boolean).at(-1) ?? '';
    return !SOURCE_EXTENSIONS.has(ext) && lastSegment.includes('.');
  } catch {
    return false;
  }
}

export type SessionAssetDoc = {
  id: string;
  kind: string;
  url: string;
  label: string;
  type: string;
  mimeType?: string;
  status?: string;
  createdAt: string | null;
  metadata?: unknown;
};

export async function listSessionAssetDocs(
  userId: string,
  sessionId: string
): Promise<SessionAssetDoc[]> {
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.flatMap((doc) => {
    const data = doc.data();
    const url = data.url;
    const kind = typeof data.kind === 'string' ? data.kind : '';
    if (typeof url !== 'string' || !kind || !isTaggableAsset(kind, url)) return [];
    const createdAt =
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : null;
    return [
      {
        id: doc.id,
        kind,
        url,
        label:
          typeof data.label === 'string' && data.label
            ? data.label
            : assetLabel(kind),
        type: assetType(kind, url),
        ...(typeof data.mimeType === 'string' ? { mimeType: data.mimeType } : {}),
        ...(typeof data.status === 'string' ? { status: data.status } : {}),
        createdAt,
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      },
    ];
  });
}
