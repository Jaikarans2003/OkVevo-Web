import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function defaultHyperframesRepoRoot(): string {
  return resolve(__dirname, "../../../../references/hyperframes");
}

const workRoot = process.env.HF_WORK_ROOT ?? join(tmpdir(), "hyperframes-renderer");
mkdirSync(workRoot, { recursive: true });

export const config = {
  port: intEnv("PORT", 3030),
  workRoot,
  /** Legacy + ZIP render temp jobs (flat multipart uses RENDER_TMP_DIR when set). */
  renderTmpDir: resolve(process.env.RENDER_TMP_DIR ?? join(process.cwd(), "tmp", "rendering")),
  outputDir: resolve(process.env.OUTPUT_DIR ?? join(process.cwd(), "output")),
  hyperframesRepo: resolve(process.env.HYPERFRAMES_REPO ?? defaultHyperframesRepoRoot()),
  maxConcurrentRenders: intEnv("MAX_CONCURRENT_RENDERS", 2),
  maxZipBytes: intEnv("HF_MAX_ZIP_BYTES", 500 * 1024 * 1024),
  maxUploadBytes: intEnv("MAX_UPLOAD_BYTES", 512 * 1024 * 1024),
  maxUncompressedBytes: intEnv("HF_MAX_UNCOMPRESSED_BYTES", 2 * 1024 * 1024 * 1024),
  maxZipEntries: intEnv("HF_MAX_ZIP_ENTRIES", 20_000),
  maxSingleExtractedFileBytes: intEnv("HF_MAX_SINGLE_FILE_BYTES", 512 * 1024 * 1024),
  renderTimeoutMs: intEnv("HF_RENDER_TIMEOUT_MS", 30 * 60 * 1000),
  hyperframesBin: process.env.HYPERFRAMES_BIN?.trim() || null,
  producerHeadlessShellPath: process.env.PRODUCER_HEADLESS_SHELL_PATH?.trim() || null,
  logLevel: process.env.LOG_LEVEL ?? "info",
  serviceName: process.env.HF_SERVICE_NAME ?? "HyperFramesRenderer",
  version: process.env.HF_VERSION ?? "1.0.0",
} as const;

mkdirSync(config.renderTmpDir, { recursive: true });
mkdirSync(config.outputDir, { recursive: true });
