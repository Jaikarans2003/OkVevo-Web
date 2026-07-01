import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export class ProjectValidationError extends Error {
  readonly code = "PROJECT_VALIDATION_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

const REQUIRED_FILES = ["index.html", "meta.json", "hyperframes.json"] as const;

export function validateHyperframesProject(projectRoot: string): void {
  const root = resolve(projectRoot);
  for (const name of REQUIRED_FILES) {
    const p = join(root, name);
    if (!existsSync(p)) {
      throw new ProjectValidationError(`Missing required file: ${name}`);
    }
  }
}

/**
 * Reject paths that escape `projectRoot` when joined (Zip-slip style names from multipart).
 */
export function sanitizeRelativeProjectPath(originalName: string, projectRoot: string): string {
  const root = resolve(projectRoot);
  const raw = originalName.trim().replace(/\\/g, "/");
  if (!raw || raw.includes("\0")) {
    throw new ProjectValidationError("Invalid file path");
  }
  if (raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) {
    throw new ProjectValidationError("File path must be relative");
  }
  const segments = raw.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      throw new ProjectValidationError("File path must not contain parent segments");
    }
    if (seg === "." || seg === "") {
      throw new ProjectValidationError("File path must not contain empty or '.' segments");
    }
  }
  const joined = join(root, raw);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (joined !== root && !joined.startsWith(prefix)) {
    throw new ProjectValidationError("Resolved path escapes project root");
  }
  return raw;
}
