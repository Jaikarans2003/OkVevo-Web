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
  return `users/${userId}/sessions/${sessionId}/hf-project/${rel}`;
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
