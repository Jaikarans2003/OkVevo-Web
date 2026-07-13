// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import {
  execCommand,
  getSessionWorkdir,
  globToRegex,
  isBinaryBuffer,
  resolveToolPath,
} from '../lib/utils';
import { walkDir } from '../../storage';

export function createFilesystemTools(ctx: { sessionId: string; userId: string }) {
  return {
    run_command: tool({
      description: `Execute a shell command in the agent's working directory.
Use this to run Manim scripts, HyperFrames CLI, ffmpeg, or any other
tool installed in the container. Returns stdout, stderr, and exit code.`,
      inputSchema: z.object({
        command: z.string().describe('Shell command to execute'),
        timeout_seconds: z
          .number()
          .optional()
          .default(300)
          .describe('Max seconds to wait. Default 300. Use 600 for Manim/HyperFrames renders.'),
      }),
      execute: async ({ command, timeout_seconds }) => {
        const result = await execCommand(command, { timeoutSeconds: timeout_seconds });
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

        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, content, 'utf-8');

        return {
          path: resolved,
          bytes_written: Buffer.byteLength(content, 'utf-8'),
        };
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
        old_string: z.string().describe('Exact text to find (must match once)'),
        new_string: z.string().describe('Replacement text'),
      }),
      execute: async ({ path: filePath, old_string, new_string }) => {
        const resolved = resolveToolPath(ctx.sessionId, filePath);

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
          const matches = content.split(old_string).length - 1;
          if (matches === 0) {
            return { error: 'old_string not found', path: resolved };
          }
          if (matches > 1) {
            return {
              error: 'old_string matched multiple times',
              path: resolved,
              matches,
            };
          }

          const updated = content.replace(old_string, new_string);
          fs.writeFileSync(resolved, updated, 'utf-8');

          return {
            path: resolved,
            bytes_written: Buffer.byteLength(updated, 'utf-8'),
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return { error: message, path: resolved };
        }
      },
    }),
  };
}
