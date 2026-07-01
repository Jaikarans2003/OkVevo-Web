import { mkdirSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import express, { type Application, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { Logger } from "pino";
import { safeRelativePath } from "./lib/safeRelativePath.js";
import { defaultHyperframesJson } from "./lib/defaultHyperframesJson.js";
import { runHyperframesRender, outputVideoPath } from "./lib/runHyperframesRender.js";
import { config } from "./config.js";

interface JobRequest extends Request {
  jobId?: string;
  jobDir?: string;
}

interface MetaRecord {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
}

export function createLegacyJobUpload() {
  return (req: Request, res: Response, next: NextFunction) => {
    const jobId = randomUUID();
    const jobDir = join(config.renderTmpDir, jobId);
    const r = req as JobRequest;
    r.jobId = jobId;
    r.jobDir = jobDir;
    mkdirSync(jobDir, { recursive: true });

    const storage = multer.diskStorage({
      destination(_req, file, cb) {
        try {
          const rel = safeRelativePath(file.fieldname);
          const dir = join(jobDir, dirname(rel));
          mkdir(dir, { recursive: true })
            .then(() => cb(null, dir))
            .catch((e) => cb(e as Error, ""));
        } catch (e) {
          cb(e as Error, "");
        }
      },
      filename(_req, file, cb) {
        try {
          const rel = safeRelativePath(file.fieldname);
          cb(null, basename(rel));
        } catch (e) {
          cb(e as Error, "");
        }
      },
    });

    const upload = multer({
      storage,
      limits: { fileSize: config.maxUploadBytes },
    });

    upload.any()(req, res, (err) => {
      if (err) {
        next(err);
        return;
      }
      next();
    });
  };
}

async function validateLegacyComposition(jobDir: string, log: Logger): Promise<MetaRecord> {
  const indexPath = join(jobDir, "index.html");
  const metaPath = join(jobDir, "meta.json");

  try {
    await readFile(indexPath);
    await readFile(metaPath);
  } catch {
    const err = new Error("Missing required files: index.html and meta.json must be uploaded");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const metaRaw = await readFile(metaPath, "utf8");
  const meta = JSON.parse(metaRaw) as MetaRecord;

  if (!meta.id || !meta.name) {
    const err = new Error("meta.json must have 'id' and 'name' fields");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const htmlRaw = await readFile(indexPath, "utf8");

  if (!/<div[^>]*\bid=["'][^"']+["']/.test(htmlRaw)) {
    const err = new Error("index.html must have root <div> with id attribute");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  if (!/<div[^>]*\bdata-composition-id=["'][^"']+["']/.test(htmlRaw)) {
    const err = new Error("index.html must have root <div> with data-composition-id attribute");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  if (!/window\.__timelines/.test(htmlRaw)) {
    const err = new Error("index.html must register timeline with window.__timelines");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  log.info({ id: meta.id, name: meta.name, width: meta.width, height: meta.height }, "legacy composition validation passed");
  return meta;
}

async function ensureProjectScaffold(jobDir: string) {
  await mkdir(join(jobDir, "compositions", "components"), { recursive: true });
  await mkdir(join(jobDir, "assets"), { recursive: true });
  const hf = join(jobDir, "hyperframes.json");
  try {
    await readFile(hf);
  } catch {
    await writeFile(hf, defaultHyperframesJson(), "utf8");
  }
}

export function registerLegacyRenderRoute(app: Application) {
  app.post("/render", createLegacyJobUpload(), async (req, res, next) => {
    const r = req as JobRequest;
    const jobId = r.jobId!;
    const jobDir = r.jobDir!;
    const log = (req as Request & { log: Logger }).log;
    const startTime = Date.now();

    log.info({ jobId }, "legacy render job started");

    try {
      const files = req.files as Express.Multer.File[] | undefined;
      log.info({ jobId, fileCount: files?.length ?? 0 }, "files uploaded");

      const meta = await validateLegacyComposition(jobDir, log);
      await ensureProjectScaffold(jobDir);

      const quality = typeof req.query.quality === "string" ? req.query.quality : "draft";
      if (!["draft", "standard", "high"].includes(quality)) {
        const err = new Error('Query "quality" must be draft, standard, or high');
        (err as Error & { status?: number }).status = 400;
        throw err;
      }

      const outAbs = outputVideoPath(config.outputDir, jobId);
      await mkdir(config.outputDir, { recursive: true });

      await runHyperframesRender({
        repoRoot: config.hyperframesRepo,
        projectDir: jobDir,
        outputFile: outAbs,
        quality,
      });

      const st = await stat(outAbs);
      const renderTime = Date.now() - startTime;

      log.info({ jobId, outputSize: st.size, renderTimeMs: renderTime }, "legacy render completed");

      await rm(jobDir, { recursive: true, force: true });

      res.json({
        ok: true,
        jobId,
        composition: meta.name,
        outputPath: outAbs,
        outputUrl: `/output/render-${jobId}.mp4`,
        quality,
        stats: {
          outputSize: st.size,
          renderTimeMs: renderTime,
          renderTimeSec: (renderTime / 1000).toFixed(2),
        },
      });
    } catch (e) {
      log.error({ jobId, err: String(e) }, "legacy render failed");
      try {
        await rm(jobDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      next(e);
    }
  });
}

export function registerOutputStatic(app: Application) {
  app.use("/output", express.static(config.outputDir));
}
