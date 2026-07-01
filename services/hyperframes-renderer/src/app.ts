import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { Logger } from "pino";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { requestLoggerMiddleware } from "./requestLogger.js";
import { registerLegacyRenderRoute, registerOutputStatic } from "./legacyRender.js";
import { extractZipSecure, ZipLimitsError, ZipSecurityError } from "./zip/extractSecure.js";
import {
  ProjectValidationError,
  validateHyperframesProject,
} from "./render/validateProject.js";
import { ffprobeJson, findPerfSummaryNearOutput } from "./render/pipeline.js";
import { buildFlatZipBundle, streamZipResponse } from "./render/bundle.js";
import { createRenderSemaphore } from "./render/semaphore.js";
import { runHyperframesRender } from "./lib/runHyperframesRender.js";
import { collectStartupDiagnostics } from "./diagnostics.js";
import { parseProjectMultipart } from "./upload/parseProjectMultipart.js";

const execFileAsync = promisify(execFile);

const semaphore = createRenderSemaphore();
const startedAt = Date.now();

function getReqLog(req: Request): Logger {
  return (req as Request & { log: Logger }).log ?? logger;
}

function errorResponse(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

function cleanupWorkspace(sessionDir: string, log: Logger) {
  try {
    rmSync(sessionDir, { recursive: true, force: true });
  } catch (e) {
    log.warn({ err: String(e), sessionDir }, "Workspace cleanup failed");
  }
}

function parseRenderOptions(sessionDir: string): RenderOptions {
  const optPath = join(sessionDir, "options-field.txt");
  if (!existsSync(optPath)) {
    return {};
  }
  const raw = readFileSync(optPath, "utf-8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as RenderOptions;
  } catch {
    throw new ProjectValidationError("Invalid JSON in options multipart field");
  }
}

type RenderOptions = {
  fps?: string;
  quality?: string;
  format?: string;
  composition?: string;
  resolution?: string;
};

function extraCliArgs(opts: RenderOptions): string[] {
  const args: string[] = [];
  if (opts.fps) args.push("--fps", opts.fps);
  if (opts.format) args.push("--format", opts.format);
  if (opts.resolution) args.push("--resolution", opts.resolution);
  if (opts.composition) args.push("-c", opts.composition);
  return args;
}

function zipQuality(opts: RenderOptions): string {
  const q = opts.quality;
  if (q && ["draft", "standard", "high"].includes(q)) return q;
  return "standard";
}

async function runBundleRenderPipeline(
  log: Logger,
  projectRoot: string,
  sessionDir: string,
  sessionId: string,
  options: RenderOptions,
): Promise<{ bundlePath: string; cliDurationMs: number }> {
  const outDir = join(sessionDir, "out");
  mkdirSync(outDir, { recursive: true });
  const mp4Path = join(outDir, "render.mp4");

  const t0 = Date.now();
  await runHyperframesRender({
    repoRoot: config.hyperframesRepo,
    projectDir: projectRoot,
    outputFile: mp4Path,
    quality: zipQuality(options),
    extraArgs: extraCliArgs(options),
  });
  const cliDurationMs = Date.now() - t0;

  if (!existsSync(mp4Path)) {
    throw new Error("Render finished but output MP4 is missing");
  }

  const metaRaw = readFileSync(join(projectRoot, "meta.json"), "utf-8");
  const hfRaw = readFileSync(join(projectRoot, "hyperframes.json"), "utf-8");
  let metaJson: unknown;
  let hfJson: unknown;
  try {
    metaJson = JSON.parse(metaRaw) as unknown;
  } catch {
    metaJson = { parseError: true, raw: metaRaw.slice(0, 2000) };
  }
  try {
    hfJson = JSON.parse(hfRaw) as unknown;
  } catch {
    hfJson = { parseError: true, raw: hfRaw.slice(0, 2000) };
  }

  const perf = await findPerfSummaryNearOutput(mp4Path);
  let probe: Record<string, unknown>;
  try {
    probe = await ffprobeJson(mp4Path);
  } catch (e) {
    probe = { error: String(e) };
  }

  const metadata = {
    renderId: sessionId,
    renderedAt: new Date().toISOString(),
    project: {
      meta: metaJson,
      hyperframes: hfJson,
    },
    probe,
  };

  const stats = {
    renderId: sessionId,
    cli: { durationMs: cliDurationMs },
    perfSummary: perf,
  };

  const metadataPath = join(sessionDir, "metadata.json");
  const statsPath = join(sessionDir, "stats.json");
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  writeFileSync(statsPath, JSON.stringify(stats, null, 2), "utf-8");

  const bundlePath = join(sessionDir, "bundle.zip");
  await buildFlatZipBundle(bundlePath, [mp4Path, metadataPath, statsPath]);

  const outputSize = existsSync(mp4Path) ? statSync(mp4Path).size : 0;
  log.info(
    {
      sessionId,
      renderId: sessionId,
      cliDurationMs,
      outputSizeBytes: outputSize,
      quality: zipQuality(options),
    },
    "render completed",
  );
  return { bundlePath, cliDurationMs };
}

function listUploadedFiles(req: Request): Express.Multer.File[] {
  const f = req.files;
  if (!f) return [];
  if (Array.isArray(f)) return f;
  return Object.values(f).flat();
}

function getProjectZipFile(req: Request): Express.Multer.File | undefined {
  return listUploadedFiles(req).find((file) => file.fieldname === "project");
}

function logRenderProjectMultipartDebug(req: Request, log: Logger) {
  const files = listUploadedFiles(req);
  const single = (req as Request & { file?: Express.Multer.File }).file;
  log.info(
    {
      renderProjectUploadDebug: {
        contentType: req.headers["content-type"],
        fieldNamesReceived: files.map((x) => x.fieldname),
        optionsFieldCaptured:
          (req as Request & { hfOptionsCaptured?: boolean }).hfOptionsCaptured ??
          existsSync(join(req.hfWorkspace?.sessionDir ?? "", "options-field.txt")),
        files: files.map((x) => ({
          fieldname: x.fieldname,
          originalname: x.originalname,
          mimetype: x.mimetype,
          size: x.size,
        })),
        reqFile: single
          ? {
              fieldname: single.fieldname,
              originalname: single.originalname,
              mimetype: single.mimetype,
              size: single.size,
            }
          : null,
        reqFilesRaw: req.files,
      },
    },
    "render-project multipart received",
  );
}

function withWorkspace(req: Request, _res: Response, next: NextFunction) {
  const sessionId = randomUUID();
  const sessionDir = join(config.workRoot, sessionId);
  mkdirSync(sessionDir, { recursive: true });
  req.hfWorkspace = { sessionId, sessionDir, projectRoot: join(sessionDir, "project") };
  next();
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestLoggerMiddleware(logger));

  app.get("/health", async (_req, res) => {
    const diag = await collectStartupDiagnostics();
    const ok = diag.ready;
    res.status(200).json({
      status: ok ? "ok" : "degraded",
      service: config.serviceName,
      version: config.version,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      hyperframesRepo: config.hyperframesRepo,
      hyperframesCli: diag.dependencies.find((d) => d.name === "hyperframes-cli")?.ok ? "ready" : "missing",
      checks: Object.fromEntries(diag.dependencies.map((d) => [d.name, d.ok])),
      renderSlots: semaphore.stats(),
    });
  });

  app.get("/ready", async (_req, res) => {
    const diag = await collectStartupDiagnostics();
    const slots = semaphore.stats();
    const ready = diag.ready && slots.active < slots.max;
    res.status(ready ? 200 : 503).json({
      ready,
      checks: Object.fromEntries(diag.dependencies.map((d) => [d.name, d.ok])),
      renderSlots: slots,
    });
  });

  registerLegacyRenderRoute(app);
  registerOutputStatic(app);

  app.post(
    "/render-project",
    withWorkspace,
    (req, res, next) => {
      parseProjectMultipart(req, res, (err) => {
        if (err) {
          const msg = String(err);
          const status = msg.includes("File too large") || msg.includes("limit") ? 413 : 400;
          res.status(status).json({
            success: false,
            error: { code: status === 413 ? "LIMIT_FILE_SIZE" : "UPLOAD_ERROR", message: msg },
          });
          if (req.hfWorkspace) cleanupWorkspace(req.hfWorkspace.sessionDir, logger);
          return;
        }
        next();
      });
    },
    async (req, res) => {
      const ws = req.hfWorkspace;
      const log = getReqLog(req);
      if (!ws) {
        errorResponse(res, 500, "INTERNAL", "workspace missing");
        return;
      }

      logRenderProjectMultipartDebug(req, log);

      let options: RenderOptions;
      try {
        options = parseRenderOptions(ws.sessionDir);
      } catch (e) {
        if (e instanceof ProjectValidationError) {
          log.warn({ sessionId: ws.sessionId, code: e.code }, "render rejected: invalid options");
          errorResponse(res, 400, e.code, e.message);
          cleanupWorkspace(ws.sessionDir, log);
          return;
        }
        throw e;
      }

      const zipFile = getProjectZipFile(req);
      if (!zipFile?.path) {
        errorResponse(
          res,
          400,
          "MISSING_PROJECT",
          'Multipart field "project" is required and must be a ZIP file (use: curl -F "project=@archive.zip")',
        );
        cleanupWorkspace(ws.sessionDir, log);
        return;
      }

      const release = await semaphore.acquire();
      let released = false;
      const releaseSlot = () => {
        if (!released) {
          released = true;
          release();
        }
      };

      log.info({ sessionId: ws.sessionId }, "render job started");

      try {
        const extractedRoot = join(ws.sessionDir, "extracted");
        await extractZipSecure(
          zipFile.path,
          extractedRoot,
          {
            maxUncompressedBytes: config.maxUncompressedBytes,
            maxEntries: config.maxZipEntries,
            maxSingleFileBytes: config.maxSingleExtractedFileBytes,
          },
          log,
        );

        let projectRoot = extractedRoot;
        const directOk =
          existsSync(join(extractedRoot, "index.html")) &&
          existsSync(join(extractedRoot, "meta.json")) &&
          existsSync(join(extractedRoot, "hyperframes.json"));
        if (!directOk) {
          const subs = readdirSync(extractedRoot).filter((name) => name !== "__MACOSX");
          if (subs.length === 1) {
            const candidate = join(extractedRoot, subs[0]!);
            if (statSync(candidate).isDirectory()) {
              projectRoot = candidate;
            }
          }
        }

        validateHyperframesProject(projectRoot);

        const { bundlePath } = await runBundleRenderPipeline(log, projectRoot, ws.sessionDir, ws.sessionId, options);

        log.info({ sessionId: ws.sessionId, bundlePath }, "render-result zip finalized");

        const streamResult = await streamZipResponse(
          bundlePath,
          `render-${ws.sessionId}.zip`,
          res,
          log,
        );

        log.info(
          {
            sessionId: ws.sessionId,
            bytesStreamed: streamResult.bytes,
            streamDurationMs: streamResult.durationMs,
          },
          "response delivery complete",
        );
      } catch (e) {
        if (e instanceof ZipSecurityError || e instanceof ZipLimitsError) {
          log.warn({ sessionId: ws.sessionId, code: e.code }, "render failed: zip security/limits");
          errorResponse(res, 400, e.code, e.message);
          return;
        }
        if (e instanceof ProjectValidationError) {
          log.warn({ sessionId: ws.sessionId, code: e.code }, "render failed: project validation");
          errorResponse(res, 400, e.code, e.message);
          return;
        }
        log.error({ sessionId: ws.sessionId, err: String(e) }, "render failed: pipeline error");
        if (!res.headersSent) {
          errorResponse(res, 500, "RENDER_FAILED", e instanceof Error ? e.message : String(e));
        }
      } finally {
        releaseSlot();
        log.info({ sessionId: ws.sessionId }, "workspace cleanup scheduled");
        cleanupWorkspace(ws.sessionDir, log);
        log.info({ sessionId: ws.sessionId }, "workspace cleanup complete");
      }
    },
  );

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "MulterError") {
      const m = err as { code?: string; message?: string };
      const status = m.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ error: m.message ?? "upload error", code: m.code });
      return;
    }
    if (
      err instanceof Error &&
      (err.message.includes("Invalid path") || err.message.includes("must be relative"))
    ) {
      res.status(400).json({ error: err.message });
      return;
    }
    const e = err as Error & { status?: number; code?: string; stderr?: string };
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    const body: Record<string, unknown> = {
      error: e.message || "Internal Server Error",
      ...(e.code ? { code: e.code } : {}),
    };
    if (status >= 500 && e.stderr) {
      body.detail = e.stderr.slice(-8000);
    }
    if (status >= 500) {
      logger.error({ err: String(err) }, "unhandled error");
    }
    res.status(status).json(body);
  });

  return app;
}
