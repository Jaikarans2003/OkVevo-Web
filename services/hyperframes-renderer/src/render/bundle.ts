import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Response } from "express";
import type { Logger } from "pino";

const execFileAsync = promisify(execFile);

/**
 * Build a flat ZIP of the given absolute file paths (entry names = basenames).
 * Requires the `zip` CLI (installed in the Docker image).
 */
export async function buildFlatZipBundle(outputZipPath: string, absoluteFilePaths: string[]): Promise<void> {
  if (absoluteFilePaths.length === 0) {
    throw new Error("buildFlatZipBundle: no input files");
  }
  await execFileAsync("zip", ["-jq", outputZipPath, ...absoluteFilePaths], {
    maxBuffer: 10 * 1024 * 1024,
  });
}

export type StreamZipResult = {
  bytes: number;
  durationMs: number;
};

/**
 * Stream a ZIP to the HTTP response and wait until all bytes are flushed.
 * Caller must not delete `zipPath` until this promise settles.
 */
export async function streamZipResponse(
  zipPath: string,
  downloadName: string,
  res: Response,
  log?: Logger,
): Promise<StreamZipResult> {
  const fileStat = await stat(zipPath);
  const bytes = fileStat.size;

  log?.info({ zipPath, bytes, downloadName }, "response stream start");

  res.status(200);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  res.setHeader("Content-Length", String(bytes));

  const t0 = Date.now();
  const stream = createReadStream(zipPath);

  try {
    await pipeline(stream, res);
    const durationMs = Date.now() - t0;
    log?.info({ zipPath, bytes, durationMs }, "response stream completed");
    return { bytes, durationMs };
  } catch (err) {
    log?.error({ zipPath, bytes, err: String(err) }, "response stream error");
    if (!res.headersSent) {
      res.status(500).json({ error: { code: "STREAM_ERROR", message: String(err) } });
    } else if (!res.writableEnded) {
      res.destroy();
    }
    throw err;
  }
}
