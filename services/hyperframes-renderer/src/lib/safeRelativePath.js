import path from "node:path";

/**
 * @param {string} raw
 * @returns {string} POSIX-style relative path safe for joining to a job root
 */
export function safeRelativePath(raw) {
  if (raw == null || typeof raw !== "string") {
    throw new Error("Invalid path");
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "." || trimmed === path.sep) {
    throw new Error("Invalid path");
  }
  const normalized = path.normalize(trimmed).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error("Path must be relative and stay within the project");
  }
  return normalized;
}
