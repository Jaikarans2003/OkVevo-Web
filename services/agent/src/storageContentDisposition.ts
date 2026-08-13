import path from 'path';

export function safeStorageBasename(storagePath: string): string {
  const cleaned = path.basename(storagePath).replace(/[/\\?%*:|"<>]/g, '_').trim();
  return cleaned || 'download';
}

export function contentDispositionForStoragePath(storagePath: string): string | undefined {
  const ext = path.extname(storagePath).toLowerCase();
  if (!['.mp4', '.webm', '.mov', '.mp3', '.flac', '.png', '.jpg', '.jpeg'].includes(ext)) {
    return undefined;
  }
  return `attachment; filename="${safeStorageBasename(storagePath)}"`;
}
