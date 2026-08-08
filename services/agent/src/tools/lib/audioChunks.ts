import fs from 'fs';
import os from 'os';
import path from 'path';
import { execCommand, getSessionWorkdir } from './utils';

/** Hard defaults from transcription plan — not env-tunable. */
export const CHUNK_STEP_SECONDS = 480;
export const CHUNK_OVERLAP_SECONDS = 2.5;
export const MAX_CHUNK_BYTES = 15 * 1024 * 1024;
export const EXTRACT_TIMEOUT_SECONDS = 900;
export const CHUNK_FFMPEG_TIMEOUT_SECONDS = 300;
export const MAX_RESPLIT_DEPTH = 2;

export type AudioWindow = {
  index: number;
  startOffsetSeconds: number;
  durationSeconds: number;
  path: string;
};

export function transcriptionDir(sessionId: string): string {
  const dir = path.join(getSessionWorkdir(sessionId), 'transcription');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function logTmpDisk(sessionId: string, tag: string): void {
  try {
    const s = fs.statfsSync(os.tmpdir());
    const freeMb = Math.round((Number(s.bavail) * Number(s.bsize)) / (1024 * 1024));
    console.error('[transcribe_video] disk', sessionId, tag, { freeMb });
  } catch {
    console.error('[transcribe_video] disk', sessionId, tag, 'unavailable');
  }
}

export function unlinkQuiet(filePath: string | null | undefined): void {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    // already gone
  }
}

export function cleanupTranscriptionLocals(sessionId: string, extra: string[] = []): void {
  for (const p of extra) unlinkQuiet(p);
  const dir = path.join(getSessionWorkdir(sessionId), 'transcription');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    unlinkQuiet(path.join(dir, name));
  }
}

export async function probeDurationSeconds(mediaPath: string): Promise<number> {
  const probe = await execCommand(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${mediaPath}"`,
    { timeoutSeconds: 60 }
  );
  if (!probe.success) {
    throw new Error(probe.stderr || 'ffprobe duration failed');
  }
  const duration = Number.parseFloat(probe.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`ffprobe returned invalid duration: ${probe.stdout.trim()}`);
  }
  return duration;
}

export async function extractFlac(inputPath: string, flacPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(flacPath), { recursive: true });
  const cmd =
    `ffmpeg -y -i "${inputPath}" -map 0:a:0 -vn -ar 16000 -ac 1 -c:a flac "${flacPath}"`;
  let result;
  try {
    result = await execCommand(cmd, { timeoutSeconds: EXTRACT_TIMEOUT_SECONDS });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOSPC') {
      throw new Error('ENOSPC: insufficient disk space during FLAC extract');
    }
    throw err;
  }
  if (!result.success) {
    const errText = result.stderr || result.stdout || 'ffmpeg FLAC extract failed';
    if (/no space left|ENOSPC/i.test(errText)) {
      throw new Error(`ENOSPC: ${errText.slice(0, 500)}`);
    }
    throw new Error(errText);
  }
}

/** Build overlapping windows: starts step by 480s; non-last duration = 480+2.5. */
export function planWindows(totalDurationSeconds: number): Omit<AudioWindow, 'path'>[] {
  const windows: Omit<AudioWindow, 'path'>[] = [];
  let start = 0;
  let index = 0;
  while (start < totalDurationSeconds - 1e-6) {
    const remaining = totalDurationSeconds - start;
    const isLast = remaining <= CHUNK_STEP_SECONDS + 1e-6;
    const duration = isLast
      ? remaining
      : Math.min(CHUNK_STEP_SECONDS + CHUNK_OVERLAP_SECONDS, remaining);
    windows.push({
      index,
      startOffsetSeconds: start,
      durationSeconds: duration,
    });
    if (isLast) break;
    start += CHUNK_STEP_SECONDS;
    index += 1;
  }
  return windows;
}

async function extractWindow(
  flacPath: string,
  startOffsetSeconds: number,
  durationSeconds: number,
  outPath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const cmd =
    `ffmpeg -y -ss ${startOffsetSeconds} -t ${durationSeconds} -i "${flacPath}" -c copy "${outPath}"`;
  const result = await execCommand(cmd, { timeoutSeconds: CHUNK_FFMPEG_TIMEOUT_SECONDS });
  if (!result.success) {
    const errText = result.stderr || result.stdout || 'ffmpeg chunk extract failed';
    if (/no space left|ENOSPC/i.test(errText)) {
      throw new Error(`ENOSPC: ${errText.slice(0, 500)}`);
    }
    throw new Error(errText);
  }
}

/**
 * Timed extracts only (not segment muxer). Re-splits any piece > ~15 MB.
 * `index` on leaves keeps the parent plan index for progress; sub-pieces share it
 * and are stitched before persist when re-split for size/413.
 */
export async function materializeWindows(
  flacPath: string,
  sessionId: string,
  planned: Omit<AudioWindow, 'path'>[]
): Promise<AudioWindow[]> {
  const dir = transcriptionDir(sessionId);
  const out: AudioWindow[] = [];

  async function materializeOne(
    win: Omit<AudioWindow, 'path'>,
    depth: number,
    suffix: string
  ): Promise<void> {
    const outPath = path.join(dir, `chunk-${win.index}${suffix}.flac`);
    await extractWindow(flacPath, win.startOffsetSeconds, win.durationSeconds, outPath);
    const bytes = fs.statSync(outPath).size;
    if (bytes <= MAX_CHUNK_BYTES || win.durationSeconds <= 30 || depth >= MAX_RESPLIT_DEPTH) {
      out.push({ ...win, path: outPath });
      return;
    }
    unlinkQuiet(outPath);
    const half = win.durationSeconds / 2;
    const overlap = Math.min(CHUNK_OVERLAP_SECONDS, half / 4);
    await materializeOne(
      {
        index: win.index,
        startOffsetSeconds: win.startOffsetSeconds,
        durationSeconds: half + overlap,
      },
      depth + 1,
      `${suffix}a`
    );
    await materializeOne(
      {
        index: win.index,
        startOffsetSeconds: win.startOffsetSeconds + half,
        durationSeconds: win.durationSeconds - half,
      },
      depth + 1,
      `${suffix}b`
    );
  }

  for (const win of planned) {
    await materializeOne(win, 0, '');
  }
  return out;
}

/** Re-extract one window from source FLAC (or parent video→flac already present). */
export async function extractSingleWindow(
  flacPath: string,
  sessionId: string,
  win: Omit<AudioWindow, 'path'>,
  suffix = ''
): Promise<AudioWindow> {
  const outPath = path.join(
    transcriptionDir(sessionId),
    `chunk-${win.index}${suffix}.flac`
  );
  await extractWindow(flacPath, win.startOffsetSeconds, win.durationSeconds, outPath);
  return { ...win, path: outPath };
}

/** Split one window in half for 413 re-split (depth checked by caller). */
export async function splitWindowInHalf(
  flacPath: string,
  sessionId: string,
  win: AudioWindow,
  depth: number
): Promise<[AudioWindow, AudioWindow]> {
  const half = win.durationSeconds / 2;
  const overlap = Math.min(CHUNK_OVERLAP_SECONDS, half / 4);
  const a = await extractSingleWindow(
    flacPath,
    sessionId,
    {
      index: win.index,
      startOffsetSeconds: win.startOffsetSeconds,
      durationSeconds: half + overlap,
    },
    `-d${depth}a`
  );
  const b = await extractSingleWindow(
    flacPath,
    sessionId,
    {
      index: win.index,
      startOffsetSeconds: win.startOffsetSeconds + half,
      durationSeconds: win.durationSeconds - half,
    },
    `-d${depth}b`
  );
  return [a, b];
}

/** Local fast-path: only trust if offsets match progress metadata. */
export function validateLocalChunkMeta(
  local: { startOffsetSeconds: number; durationSeconds: number },
  expected: { startOffsetSeconds: number; durationSeconds: number }
): boolean {
  return (
    Math.abs(local.startOffsetSeconds - expected.startOffsetSeconds) < 1e-3 &&
    Math.abs(local.durationSeconds - expected.durationSeconds) < 1e-3
  );
}
