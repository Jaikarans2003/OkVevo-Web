import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import yauzl from "yauzl";
import type { Entry, ZipFile } from "yauzl";
import type { Logger } from "pino";

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

export class ZipSecurityError extends Error {
  readonly code = "ZIP_SECURITY_VIOLATION";
  constructor(message: string) {
    super(message);
    this.name = "ZipSecurityError";
  }
}

export class ZipLimitsError extends Error {
  readonly code = "ZIP_LIMIT_EXCEEDED";
  constructor(message: string) {
    super(message);
    this.name = "ZipLimitsError";
  }
}

function isInsideRoot(rootAbs: string, candidateAbs: string): boolean {
  const root = resolve(rootAbs);
  const candidate = resolve(candidateAbs);
  if (candidate === root) return true;
  const prefix = root.endsWith(sep) ? root : root + sep;
  return candidate.startsWith(prefix);
}

function assertSafeRelativePath(fileName: string): void {
  if (!fileName || fileName.includes("\0")) {
    throw new ZipSecurityError("Invalid ZIP entry name");
  }
  const normalized = fileName.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new ZipSecurityError("ZIP entry path must be relative");
  }
  const segments = normalized.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      throw new ZipSecurityError("ZIP entry must not contain parent directory segments");
    }
  }
}

function isSymlinkEntry(entry: Entry): boolean {
  const unixMode = (entry.externalFileAttributes ?? 0) >>> 16;
  return (unixMode & S_IFMT) === S_IFLNK;
}

/**
 * Extract a ZIP archive into `destRoot` with Zip-slip protection, symlink
 * rejection, and uncompressed-size / entry-count limits.
 */
export async function extractZipSecure(
  zipPath: string,
  destRoot: string,
  limits: {
    maxUncompressedBytes: number;
    maxEntries: number;
    maxSingleFileBytes: number;
  },
  log: Logger,
): Promise<void> {
  const rootAbs = resolve(destRoot);
  mkdirSync(rootAbs, { recursive: true });

  let totalWritten = 0;
  let entryCount = 0;

  const zipfile = await new Promise<ZipFile>((res, rej) => {
    yauzl.open(
      zipPath,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (err: Error | null, zf: yauzl.ZipFile | undefined) => {
        if (err || !zf) rej(err ?? new Error("Failed to open ZIP"));
        else res(zf);
      },
    );
  });

  const handleEntry = (entry: Entry): Promise<void> => {
    entryCount += 1;
    if (entryCount > limits.maxEntries) {
      return Promise.reject(
        new ZipLimitsError(`ZIP exceeds max entry count (${limits.maxEntries})`),
      );
    }

    const rawName = entry.fileName;
    assertSafeRelativePath(rawName);

    if (isSymlinkEntry(entry)) {
      return Promise.reject(new ZipSecurityError("ZIP must not contain symlink entries"));
    }

    const targetPath = join(rootAbs, rawName);
    if (!isInsideRoot(rootAbs, targetPath)) {
      return Promise.reject(new ZipSecurityError("ZIP path escapes extraction directory"));
    }

    if (/\/\.(\/|$)/.test(rawName.replace(/\\/g, "/"))) {
      return Promise.reject(new ZipSecurityError("ZIP path must not contain '.' segments"));
    }

    const isDir = /\/$/.test(rawName);

    if (isDir) {
      mkdirSync(targetPath, { recursive: true });
      return Promise.resolve();
    }

    if (entry.uncompressedSize > limits.maxSingleFileBytes) {
      return Promise.reject(
        new ZipLimitsError(
          `ZIP entry "${rawName}" exceeds max uncompressed size (${limits.maxSingleFileBytes} bytes)`,
        ),
      );
    }

    if (totalWritten + entry.uncompressedSize > limits.maxUncompressedBytes) {
      return Promise.reject(
        new ZipLimitsError(
          `ZIP uncompressed total would exceed limit (${limits.maxUncompressedBytes} bytes)`,
        ),
      );
    }

    mkdirSync(dirname(targetPath), { recursive: true });

    return new Promise<void>((res, rej) => {
      zipfile.openReadStream(entry, (err: Error | null, readStream: Readable | undefined) => {
        if (err || !readStream) {
          rej(err ?? new Error("openReadStream failed"));
          return;
        }

        let streamed = 0;
        readStream.on("data", (chunk: Buffer | string) => {
          const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
          streamed += len;
          if (streamed > entry.uncompressedSize + 1024) {
            readStream.destroy(new ZipSecurityError("ZIP entry grew beyond declared size"));
          }
        });

        const out = createWriteStream(targetPath, { flags: "wx" });
        out.on("error", (e: NodeJS.ErrnoException) => {
          if (e.code === "EEXIST") {
            rej(new ZipSecurityError("ZIP entry collides with existing path"));
          } else {
            rej(e);
          }
        });

        void pipeline(readStream, out)
          .then(() => {
            totalWritten += streamed;
            res();
          })
          .catch(rej);
      });
    });
  };

  try {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      zipfile.on("error", rejectPromise);

      zipfile.on("entry", (entry: Entry) => {
        void handleEntry(entry)
          .then(() => {
            zipfile.readEntry();
          })
          .catch(rejectPromise);
      });

      zipfile.on("end", () => {
        resolvePromise();
      });

      zipfile.readEntry();
    });
  } finally {
    zipfile.close();
  }

  log.info({ entries: entryCount, totalWritten }, "ZIP extracted securely");
}
