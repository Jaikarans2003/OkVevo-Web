// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import {
  artifactNeedsForResolvedPath,
  ensureSessionArtifacts,
  execCommand,
  getSessionWorkdir,
  globToRegex,
  isBinaryBuffer,
  resolveToolPath,
  sanitizedShellEnv,
} from '../lib/utils';
import { assertManimMaxVisible, isManimScriptPath } from '../lib/manimGuard';
import { pickStrReplacePair } from '../lib/strReplaceDecode';
import {
  isHfProjectPath,
  oldStringNotFoundError,
  syncHfProjectFileAfterEdit,
} from '../lib/hfProjectSync';
import {
  commandTargetsOwnedEditFile,
  OWNED_EDIT_SHELL_STDERR,
} from '../lib/ownedEditFiles';
import { uploadFileToStorageKeepLocal, walkDir } from '../../storage';
import type { ResolvedTaggedAsset } from '../../taggedAssets';
import { getCommandPolicy } from '../../catalog/manifest';

async function ensurePathArtifacts(
  ctx: {
    sessionId: string;
    userId: string;
    taggedArtifacts?: ResolvedTaggedAsset[];
  },
  resolvedPath: string
): Promise<void> {
  if (fs.existsSync(resolvedPath)) return;
  const needs = artifactNeedsForResolvedPath(
    ctx.sessionId,
    resolvedPath,
    ctx.taggedArtifacts
  );
  if (needs.length === 0) return;
  await ensureSessionArtifacts(ctx.userId, ctx.sessionId, needs);
}

export function referencesProcEnviron(command: string): boolean {
  return /\/proc\/[^/\s'"]+\/environ\b/.test(command);
}

/** First argv token or known binary name for command-prefix policy. */
export function commandBinaryToken(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return '';
  // Strip env assignments: FOO=bar ffmpeg ...
  const withoutEnv = trimmed.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '');
  const token = withoutEnv.split(/\s+/)[0] ?? '';
  return path.basename(token.replace(/^['"]|['"]$/g, ''));
}

export function commandAllowedBySkillPrefixes(
  command: string,
  prefixes: readonly string[] | undefined
): boolean {
  if (!prefixes) return true;
  if (prefixes.length === 0) return false;
  const binary = commandBinaryToken(command);
  return prefixes.includes(binary);
}

export function createFilesystemTools(ctx: {
  sessionId: string;
  userId: string;
  skillName?: string;
  taggedArtifacts?: ResolvedTaggedAsset[];
}) {
  return {
    run_command: tool({
      description: `Execute a shell command in the agent's working directory.
Use this to run Manim scripts, HyperFrames CLI, ffmpeg, or any other
tool installed in the container. Never reimplement a missing pipeline tool
with shell/CLI and never read credentials from environment variables; if a
pipeline tool is missing, say so and stop.
Do not use shell to rewrite owned edit files (hf-project/index.html,
hf-project/compositions/**/*.html, hf-project/COMPOSITION_MANIFEST.json,
manim_scripts/**/*.py) — use write_file or str_replace. Asset ingestion under
hf-project/capture/assets or hf-project/assets via mkdir/curl/cp is allowed.
Returns stdout, stderr, and exit code.`,
      inputSchema: z.object({
        command: z.string().describe('Shell command to execute'),
        timeout_seconds: z
          .number()
          .optional()
          .default(300)
          .describe('Max seconds to wait. Default 300. Use 600 for Manim/HyperFrames renders.'),
      }),
      execute: async ({ command, timeout_seconds }) => {
        // ponytail: string guard blocks the known root-container escape; use a separate uid for full isolation.
        if (referencesProcEnviron(command)) {
          return {
            stdout: '',
            stderr: 'Reading process environments is not allowed.',
            exit_code: 1,
            success: false,
          };
        }
        if (commandTargetsOwnedEditFile(command)) {
          return {
            stdout: '',
            stderr: OWNED_EDIT_SHELL_STDERR,
            exit_code: 1,
            success: false,
          };
        }
        if (!commandAllowedBySkillPrefixes(command, getCommandPolicy(ctx.skillName))) {
          return {
            stdout: '',
            stderr: `Command not allowed for skill "${ctx.skillName}".`,
            exit_code: 1,
            success: false,
          };
        }
        const referenced = (ctx.taggedArtifacts ?? []).filter((artifact) =>
          command.includes(artifact.localPath)
        );
        if (referenced.length > 0) {
          await ensureSessionArtifacts(ctx.userId, ctx.sessionId, referenced);
        }
        const result = await execCommand(command, {
          timeoutSeconds: timeout_seconds,
          env: sanitizedShellEnv(),
        });
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exit_code: result.exit_code,
          success: result.success,
        };
      },
    }),

    write_file: tool({
      description: `Write text content to a file path on disk. Use before run_command
to create Manim Python scripts, HyperFrames index.html, meta.json, etc.
Paths are relative to the session work directory unless absolute.`,
      inputSchema: z.object({
        path: z.string().describe('File path to write'),
        content: z.string().describe('UTF-8 file content'),
      }),
      execute: async ({ path: filePath, content }) => {
        const baseDir = getSessionWorkdir(ctx.sessionId);
        const resolved =
          path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);

        // Restore parent artifact family when patching a missing session file
        if (!fs.existsSync(resolved)) {
          await ensurePathArtifacts(ctx, resolved);
        }

        if (isManimScriptPath(resolved)) {
          const maxVisibleError = assertManimMaxVisible(content);
          if (maxVisibleError) {
            return { error: maxVisibleError, path: resolved };
          }
        }

        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, content, 'utf-8');

        const result: {
          path: string;
          bytes_written: number;
          sync_warning?: string;
        } = {
          path: resolved,
          bytes_written: Buffer.byteLength(content, 'utf-8'),
        };
        if (isHfProjectPath(resolved)) {
          const sync = await syncHfProjectFileAfterEdit(
            ctx.userId,
            ctx.sessionId,
            resolved,
            uploadFileToStorageKeepLocal
          );
          if (sync?.warning) result.sync_warning = sync.warning;
        }
        return result;
      },
    }),

    read_file: tool({
      description:
        'Read the contents of a file from disk. Use this to read any file in the session workdir, project directory, or Skills directory. Returns file contents as a string. For binary files returns a message saying the file is binary and cannot be read as text.',
      inputSchema: z.object({
        path: z
          .string()
          .describe('Absolute path or path relative to session workdir'),
        max_bytes: z
          .number()
          .optional()
          .default(50000)
          .describe(
            'Max bytes to read. Default 50000. Truncates from end if file is larger.'
          ),
      }),
      execute: async ({ path: filePath, max_bytes }) => {
        const resolved = resolveToolPath(ctx.sessionId, filePath);
        await ensurePathArtifacts(ctx, resolved);

        try {
          if (!fs.existsSync(resolved)) {
            return { error: 'File not found', path: resolved };
          }

          const stat = fs.statSync(resolved);
          if (stat.isDirectory()) {
            return { error: 'Path is a directory', path: resolved };
          }

          const buf = fs.readFileSync(resolved);
          if (isBinaryBuffer(buf)) {
            return {
              path: resolved,
              content: 'File is binary and cannot be read as text.',
              bytes: buf.length,
              truncated: false,
            };
          }

          const truncated = buf.length > max_bytes;
          const slice = truncated ? buf.subarray(0, max_bytes) : buf;
          let content = slice.toString('utf-8');
          if (truncated) {
            content += `\n[truncated — file has ${buf.length} total bytes]`;
          }

          return {
            path: resolved,
            content,
            bytes: buf.length,
            truncated,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return { error: message, path: resolved };
        }
      },
    }),

    search_files: tool({
      description:
        'Search for files by name pattern or search file contents for a text string. Use this to find which file contains a specific selector, placeholder, or text. Returns matching file paths and optionally the matching lines.',
      inputSchema: z.object({
        directory: z
          .string()
          .describe(
            'Directory to search in. Relative paths resolved against session workdir.'
          ),
        pattern: z
          .string()
          .optional()
          .describe(
            'Filename glob pattern e.g. "*.html", "*.json". If omitted, searches all files.'
          ),
        content_search: z
          .string()
          .optional()
          .describe(
            'Text string to search for inside files. Returns matching lines with line numbers.'
          ),
        max_results: z
          .number()
          .optional()
          .default(20)
          .describe('Max number of matching files to return.'),
      }),
      execute: async ({ directory, pattern, content_search, max_results }) => {
        const resolved = resolveToolPath(ctx.sessionId, directory);
        await ensurePathArtifacts(ctx, resolved);

        if (!fs.existsSync(resolved)) {
          return { error: 'Directory not found', matches: [] };
        }

        let allFiles: string[];
        try {
          allFiles = walkDir(resolved);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return { error: message, matches: [] };
        }

        const globRegex = pattern ? globToRegex(pattern) : null;
        const candidates = globRegex
          ? allFiles.filter((file) => globRegex.test(path.basename(file)))
          : allFiles;

        const matches: Array<{
          path: string;
          relative: string;
          content_matches?: Array<{ line_number: number; line: string }>;
        }> = [];

        for (const file of candidates) {
          if (matches.length >= max_results) {
            break;
          }

          const entry: {
            path: string;
            relative: string;
            content_matches?: Array<{ line_number: number; line: string }>;
          } = {
            path: file,
            relative: path.relative(resolved, file),
          };

          if (content_search) {
            try {
              const buf = fs.readFileSync(file);
              if (isBinaryBuffer(buf)) {
                continue;
              }
              const lines = buf.toString('utf-8').split('\n');
              const contentMatches: Array<{ line_number: number; line: string }> = [];
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(content_search)) {
                  contentMatches.push({ line_number: i + 1, line: lines[i] });
                }
              }
              if (contentMatches.length === 0) {
                continue;
              }
              entry.content_matches = contentMatches;
            } catch {
              continue;
            }
          }

          matches.push(entry);
        }

        return {
          directory: resolved,
          files_searched: candidates.length,
          matches,
        };
      },
    }),

    str_replace: tool({
      description:
        'Replace exactly one occurrence of a string in a text file. Fails if old_string is not found or appears more than once. Paths are resolved like read_file.',
      inputSchema: z.object({
        path: z.string().describe('Absolute path or path relative to session workdir'),
        old_string: z
          .string()
          .describe('Exact text to find (must match once; use real newlines, not \\n escapes)'),
        new_string: z
          .string()
          .describe('Replacement text (use real newlines, not \\n escapes)'),
      }),
      execute: async ({ path: filePath, old_string, new_string }) => {
        const resolved = resolveToolPath(ctx.sessionId, filePath);
        await ensurePathArtifacts(ctx, resolved);

        try {
          if (!fs.existsSync(resolved)) {
            return { error: 'File not found', path: resolved };
          }

          const stat = fs.statSync(resolved);
          if (stat.isDirectory()) {
            return { error: 'Path is a directory', path: resolved };
          }

          const buf = fs.readFileSync(resolved);
          if (isBinaryBuffer(buf)) {
            return { error: 'File is binary and cannot be edited as text', path: resolved };
          }

          const content = buf.toString('utf-8');
          const picked = pickStrReplacePair(content, old_string, new_string);
          if (picked.matches === 0) {
            return { error: oldStringNotFoundError(resolved), path: resolved };
          }
          if (picked.matches > 1) {
            return {
              error: 'old_string matched multiple times',
              path: resolved,
              matches: picked.matches,
            };
          }

          const updated = content.replace(picked.old_string, picked.new_string);

          if (isManimScriptPath(resolved)) {
            const maxVisibleError = assertManimMaxVisible(updated);
            if (maxVisibleError) {
              return { error: maxVisibleError, path: resolved };
            }
          }

          fs.writeFileSync(resolved, updated, 'utf-8');

          const result: {
            path: string;
            bytes_written: number;
            sync_warning?: string;
          } = {
            path: resolved,
            bytes_written: Buffer.byteLength(updated, 'utf-8'),
          };
          if (isHfProjectPath(resolved)) {
            const sync = await syncHfProjectFileAfterEdit(
              ctx.userId,
              ctx.sessionId,
              resolved,
              uploadFileToStorageKeepLocal
            );
            if (sync?.warning) result.sync_warning = sync.warning;
          }
          return result;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return { error: message, path: resolved };
        }
      },
    }),
  };
}
