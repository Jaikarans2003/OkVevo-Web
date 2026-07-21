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

export function assetLabel(key: string): string {
  return key
    .replace(/^uploaded_video_/, '')
    .replace(/^manim_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function assetType(key: string, url: string): string {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if (['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) return 'audio';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return 'image';
  if (key === 'transcript') return 'transcript';
  if (['.json', '.csv', '.txt', '.srt', '.vtt'].includes(ext)) return 'data';
  return 'file';
}

export function isTaggableAsset(key: string, url: string): boolean {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname);
    const ext = path.extname(pathname).toLowerCase();
    const lastSegment = pathname.split('/').filter(Boolean).at(-1) ?? '';
    return !SOURCE_EXTENSIONS.has(ext) && lastSegment.includes('.');
  } catch {
    return false;
  }
}

export function uploadedVideoAssetKey(filename: string): string {
  const stable = filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `uploaded_video_${stable || 'video'}`;
}
