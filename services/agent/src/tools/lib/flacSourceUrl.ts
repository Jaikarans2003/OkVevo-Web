/**
 * FLAC ↔ videoUrl sidecar contract (local files only; no Firebase).
 * Sidecar path: `{flacPath}.source_url` containing the source video URL.
 */
import fs from 'fs';
import path from 'path';

export function flacSourceUrlLocalPath(flacPath: string): string {
  return `${flacPath}.source_url`;
}

function unlinkQuiet(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // already gone
  }
}

/** True only when FLAC exists and sidecar text equals videoUrl. Missing sidecar ⇒ false. */
export function flacMatchesVideo(flacPath: string, videoUrl: string): boolean {
  if (!fs.existsSync(flacPath) || fs.statSync(flacPath).size <= 0) return false;
  const sidecar = flacSourceUrlLocalPath(flacPath);
  if (!fs.existsSync(sidecar)) return false;
  try {
    return fs.readFileSync(sidecar, 'utf-8').trim() === videoUrl.trim();
  } catch {
    return false;
  }
}

export function writeFlacSourceUrl(flacPath: string, videoUrl: string): void {
  fs.mkdirSync(path.dirname(flacPath), { recursive: true });
  fs.writeFileSync(flacSourceUrlLocalPath(flacPath), videoUrl, 'utf-8');
}

export function clearLocalFlac(flacPath: string): void {
  unlinkQuiet(flacPath);
  unlinkQuiet(flacSourceUrlLocalPath(flacPath));
}

/** Pure stale-progress rule: different videoUrl ⇒ wipe audio + reset caption applied. */
export function mustInvalidateStaleVideo(
  progressVideoUrl: string | undefined | null,
  newVideoUrl: string
): boolean {
  return typeof progressVideoUrl === 'string' && progressVideoUrl !== newVideoUrl;
}
