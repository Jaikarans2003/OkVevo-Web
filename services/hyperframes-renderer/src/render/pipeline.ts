import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const execFileAsync = promisify(execFile);

export async function findPerfSummaryNearOutput(outputMp4Path: string): Promise<unknown | null> {
  const outDir = dirname(outputMp4Path);
  let names: string[];
  try {
    names = await readdir(outDir);
  } catch {
    return null;
  }
  let bestPath: string | null = null;
  let bestMtime = 0;
  for (const name of names) {
    if (!name.startsWith("work-")) continue;
    const dirPath = join(outDir, name);
    try {
      const st = await stat(dirPath);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    const perfPath = join(dirPath, "perf-summary.json");
    try {
      const s = await stat(perfPath);
      if (s.mtimeMs >= bestMtime) {
        bestMtime = s.mtimeMs;
        bestPath = perfPath;
      }
    } catch {
      /* skip */
    }
  }
  if (!bestPath) return null;
  try {
    const raw = await readFile(bestPath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function ffprobeJson(videoPath: string): Promise<Record<string, unknown>> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", videoPath],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as Record<string, unknown>;
}
