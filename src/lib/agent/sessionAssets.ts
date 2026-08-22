import path from 'node:path';

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
  // Kind wins for user uploads — Firebase download URLs often lack a usable ext
  // (.heic, encoded paths, no-ext originals) and AssetThumb keys off type.
  if (kind === 'uploaded_video') return 'video';
  if (kind === 'uploaded_image') return 'image';
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return 'file';
  }
  const ext = path.extname(pathname).toLowerCase();
  if (['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) return 'audio';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.avif'].includes(ext))
    return 'image';
  if (kind === 'transcript') return 'transcript';
  if (['.json', '.csv', '.txt', '.srt', '.vtt'].includes(ext)) return 'data';
  return 'file';
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

type AssetDocInput = {
  id: string;
  kind: string;
  url: string;
  label?: string;
  mimeType?: string;
  status?: string;
  createdAt: string | null;
  metadata?: unknown;
};

/** Deduped taggable assets — unique URLs keep every run's drafts. */
export function selectTaggableSessionAssets(
  docs: AssetDocInput[]
): SessionAssetDoc[] {
  const seenUrls = new Set<string>();
  const out: SessionAssetDoc[] = [];
  for (const data of docs) {
    if (!data.kind || !isTaggableAsset(data.kind, data.url)) continue;
    if (seenUrls.has(data.url)) continue;
    seenUrls.add(data.url);
    out.push({
      id: data.id,
      kind: data.kind,
      url: data.url,
      label: data.label && data.label.length > 0 ? data.label : assetLabel(data.kind),
      type: assetType(data.kind, data.url),
      ...(data.mimeType ? { mimeType: data.mimeType } : {}),
      ...(data.status ? { status: data.status } : {}),
      createdAt: data.createdAt,
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    });
  }
  return out;
}

export async function listSessionAssetDocs(
  userId: string,
  sessionId: string
): Promise<SessionAssetDoc[]> {
  const { Timestamp } = await import('firebase-admin/firestore');
  const { db } = await import('@/lib/firebase-admin');
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .orderBy('createdAt', 'desc')
    .get();

  return selectTaggableSessionAssets(
    snap.docs.map((doc) => {
      const data = doc.data();
      const createdAt =
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : null;
      return {
        id: doc.id,
        kind: typeof data.kind === 'string' ? data.kind : '',
        url: typeof data.url === 'string' ? data.url : '',
        label: typeof data.label === 'string' ? data.label : undefined,
        mimeType: typeof data.mimeType === 'string' ? data.mimeType : undefined,
        status: typeof data.status === 'string' ? data.status : undefined,
        createdAt,
        metadata: data.metadata,
      };
    })
  );
}
