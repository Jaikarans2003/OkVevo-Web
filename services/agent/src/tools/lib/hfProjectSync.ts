import fs from 'fs';
import path from 'path';
import { getSessionWorkdir } from './utils';

export function isHfProjectPath(resolvedPath: string): boolean {
  return /[/\\]hf-project[/\\]/.test(resolvedPath);
}

export function oldStringNotFoundError(resolvedPath: string): string {
  if (!isHfProjectPath(resolvedPath)) return 'old_string not found';
  return `old_string not found. Call read_file on "${resolvedPath}" before retrying str_replace — do not guess content and do not use run_command.`;
}

export function newScaffoldRunId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function runHfProjectPrefix(
  userId: string,
  sessionId: string,
  skillId: string,
  runId: string
): string {
  return `users/${userId}/sessions/${sessionId}/runs/${skillId}-${runId}/hf-project`;
}

type ScaffoldRunStamp = { skillId: string; runId: string };

function stampPath(workdir: string): string {
  return path.join(workdir, '.scaffold-run.json');
}

export function writeScaffoldRunStamp(
  workdir: string,
  stamp: ScaffoldRunStamp
): void {
  fs.writeFileSync(stampPath(workdir), JSON.stringify(stamp));
}

export function readScaffoldRunStamp(workdir: string): ScaffoldRunStamp | null {
  const p = stampPath(workdir);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
    if (
      raw &&
      typeof raw === 'object' &&
      typeof (raw as ScaffoldRunStamp).skillId === 'string' &&
      typeof (raw as ScaffoldRunStamp).runId === 'string'
    ) {
      return raw as ScaffoldRunStamp;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Re-stamp local workdir from a run-scoped GCS prefix after restore. */
export function stampFromStoragePrefix(workdir: string, storagePath: string): void {
  const m = storagePath.match(/\/runs\/([^/]+)\/hf-project(?:\/|$)/);
  if (!m) return;
  const combined = m[1]!;
  const i = combined.lastIndexOf('-');
  if (i <= 0 || combined.length - i - 1 !== 8) return;
  writeScaffoldRunStamp(workdir, {
    skillId: combined.slice(0, i),
    runId: combined.slice(i + 1),
  });
}

/** Storage object path for a local hf-project file, or null if outside the tree. */
export function hfProjectObjectPath(
  userId: string,
  sessionId: string,
  resolvedPath: string,
  workdir = getSessionWorkdir(sessionId)
): string | null {
  const projectDir = path.join(workdir, 'hf-project');
  const rel = path.relative(projectDir, resolvedPath).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const stamp = readScaffoldRunStamp(workdir);
  const prefix = stamp
    ? runHfProjectPrefix(userId, sessionId, stamp.skillId, stamp.runId)
    : `users/${userId}/sessions/${sessionId}/hf-project`;
  return `${prefix}/${rel}`;
}

export type HfProjectUpload = (
  localFilePath: string,
  storagePath: string
) => Promise<string>;

/**
 * After a successful local write under hf-project, overwrite the GCS object.
 * Non-fatal: returns a warning string on failure; local edit stays.
 */
export async function syncHfProjectFileAfterEdit(
  userId: string,
  sessionId: string,
  resolvedPath: string,
  upload: HfProjectUpload,
  workdir = getSessionWorkdir(sessionId)
): Promise<{ storagePath: string; warning?: string } | null> {
  if (!isHfProjectPath(resolvedPath) || !fs.existsSync(resolvedPath)) {
    return null;
  }
  const storagePath = hfProjectObjectPath(userId, sessionId, resolvedPath, workdir);
  if (!storagePath) return null;
  try {
    await upload(resolvedPath, storagePath);
    return { storagePath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[hfProjectSync] upload failed (local edit kept):', message);
    return {
      storagePath,
      warning: `hf-project GCS sync failed (local edit kept): ${message}`,
    };
  }
}
