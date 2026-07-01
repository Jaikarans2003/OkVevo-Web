/**
 * @deprecated Use the TypeScript server: `bun run src/index.ts` (Docker CMD). Kept for reference.
 */
import express from "express";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { safeRelativePath } from "./lib/safeRelativePath.js";
import {
  resolveHyperframesRepoRoot,
  resolveCliEntry,
  assertCliBuilt,
} from "./lib/hyperframesPaths.js";
import { defaultHyperframesJson } from "./lib/defaultHyperframesJson.js";
import { runHyperframesRender, outputVideoPath } from "./lib/runHyperframesRender.js";

const PORT = Number(process.env.PORT || 3030);
const TMP_ROOT = path.resolve(process.env.RENDER_TMP_DIR || "./tmp/rendering");
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || "./output");
const HYPERFRAMES_REPO = resolveHyperframesRepoRoot(process.env.HYPERFRAMES_REPO);

// Structured logging
function log(level, message, meta = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

function cliHealth() {
  try {
    const cli = resolveCliEntry(HYPERFRAMES_REPO);
    assertCliBuilt(cli);
    return { ok: true, cliPath: cli };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function createJobUpload() {
  return (req, res, next) => {
    const jobId = randomUUID();
    const jobDir = path.join(TMP_ROOT, jobId);
    req.jobId = jobId;
    req.jobDir = jobDir;
    fsSync.mkdirSync(jobDir, { recursive: true });

    const storage = multer.diskStorage({
      destination(_req, file, cb) {
        try {
          const rel = safeRelativePath(file.fieldname);
          const dir = path.join(jobDir, path.dirname(rel));
          fs.mkdir(dir, { recursive: true })
            .then(() => cb(null, dir))
            .catch(cb);
        } catch (e) {
          cb(e);
        }
      },
      filename(_req, file, cb) {
        try {
          const rel = safeRelativePath(file.fieldname);
          cb(null, path.basename(rel));
        } catch (e) {
          cb(e);
        }
      },
    });

    const upload = multer({
      storage,
      limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 512 * 1024 * 1024) },
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

async function validateComposition(jobDir) {
  const indexPath = path.join(jobDir, "index.html");
  const metaPath = path.join(jobDir, "meta.json");
  
  // Check files exist first
  try {
    await fs.access(indexPath);
    await fs.access(metaPath);
  } catch {
    const err = new Error("Missing required files: index.html and meta.json must be uploaded");
    err.status = 400;
    throw err;
  }
  
  // Read and validate meta.json
  const metaRaw = await fs.readFile(metaPath, "utf8");
  const meta = JSON.parse(metaRaw);
  
  if (!meta.id || !meta.name) {
    const err = new Error("meta.json must have 'id' and 'name' fields");
    err.status = 400;
    throw err;
  }
  
  // Read index.html and check for required attributes
  const htmlRaw = await fs.readFile(indexPath, "utf8");
  
  // Check for root div with id attribute
  const hasId = /<div[^>]*\bid=["'][^"']+["']/.test(htmlRaw);
  if (!hasId) {
    const err = new Error(
      "index.html must have root <div> with id attribute"
    );
    err.status = 400;
    throw err;
  }
  
  // Check for data-composition-id attribute
  const hasCompositionId = /<div[^>]*\bdata-composition-id=["'][^"']+["']/.test(htmlRaw);
  if (!hasCompositionId) {
    const err = new Error(
      "index.html must have root <div> with data-composition-id attribute"
    );
    err.status = 400;
    throw err;
  }
  
  // Check for window.__timelines registration
  const hasTimeline = /window\.__timelines/.test(htmlRaw);
  if (!hasTimeline) {
    const err = new Error(
      "index.html must register timeline with window.__timelines"
    );
    err.status = 400;
    throw err;
  }
  
  log("info", "Composition validation passed", {
    id: meta.id,
    name: meta.name,
    width: meta.width,
    height: meta.height,
  });
  
  return meta;
}

async function ensureProjectScaffold(jobDir) {
  await fs.mkdir(path.join(jobDir, "compositions", "components"), { recursive: true });
  await fs.mkdir(path.join(jobDir, "assets"), { recursive: true });
  const hf = path.join(jobDir, "hyperframes.json");
  try {
    await fs.access(hf);
  } catch {
    await fs.writeFile(hf, defaultHyperframesJson(), "utf8");
  }
}

const app = express();

app.get("/health", (_req, res) => {
  const hf = cliHealth();
  res.json({
    status: "ok",
    service: "@okvevo/hyperframes",
    hyperframesCli: hf.ok ? "ready" : "missing",
    hyperframesRepo: HYPERFRAMES_REPO,
    ...(hf.ok ? { cliPath: hf.cliPath } : { hyperframesError: hf.error }),
  });
});

app.post("/render", createJobUpload(), async (req, res, next) => {
  const { jobId, jobDir } = req;
  const startTime = Date.now();
  
  log("info", "Render job started", { jobId });
  
  try {
    // Validate uploaded files
    const files = req.files || [];
    log("info", "Files uploaded", {
      jobId,
      fileCount: files.length,
      files: files.map(f => ({ field: f.fieldname, size: f.size })),
    });
    
    // Check required files and validate composition
    const meta = await validateComposition(jobDir);
    await ensureProjectScaffold(jobDir);

    const quality = typeof req.query.quality === "string" ? req.query.quality : "draft";
    if (!["draft", "standard", "high"].includes(quality)) {
      const err = new Error('Query "quality" must be draft, standard, or high');
      err.status = 400;
      throw err;
    }

    log("info", "Starting HyperFrames render", {
      jobId,
      quality,
      composition: meta.name,
    });

    const outAbs = outputVideoPath(OUTPUT_DIR, jobId);
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const { stdout, stderr } = await runHyperframesRender({
      repoRoot: HYPERFRAMES_REPO,
      projectDir: jobDir,
      outputFile: outAbs,
      quality,
    });

    // Get output file stats
    const stats = await fs.stat(outAbs);
    const renderTime = Date.now() - startTime;

    log("info", "Render completed", {
      jobId,
      outputSize: stats.size,
      renderTimeMs: renderTime,
    });

    // Cleanup job directory
    await fs.rm(jobDir, { recursive: true, force: true });

    res.json({
      ok: true,
      jobId,
      composition: meta.name,
      outputPath: outAbs,
      outputUrl: `/output/render-${jobId}.mp4`,
      quality,
      stats: {
        outputSize: stats.size,
        renderTimeMs: renderTime,
        renderTimeSec: (renderTime / 1000).toFixed(2),
      },
    });
  } catch (e) {
    log("error", "Render failed", {
      jobId,
      error: e.message,
      renderTimeMs: Date.now() - startTime,
    });
    
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }
    next(e);
  }
});

/** Static download of rendered files (local dev convenience) */
app.use("/output", express.static(OUTPUT_DIR));

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  if (err && err.name === "MulterError") {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  if (
    typeof err?.message === "string" &&
    (err.message.includes("Invalid path") || err.message.includes("must be relative"))
  ) {
    res.status(400).json({ error: err.message });
    return;
  }
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const body = {
    error: err.message || "Internal Server Error",
    ...(err.code ? { code: err.code } : {}),
    ...(status >= 500 && err.stderr ? { detail: err.stderr.slice(-8000) } : {}),
  };
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json(body);
});

await fs.mkdir(TMP_ROOT, { recursive: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

log("info", "HyperFrames render service starting", {
  port: PORT,
  tmpRoot: TMP_ROOT,
  outputDir: OUTPUT_DIR,
  hyperframesRepo: HYPERFRAMES_REPO,
});

app.listen(PORT, () => {
  log("info", "Service listening", { port: PORT, url: `http://127.0.0.1:${PORT}` });
  
  const hf = cliHealth();
  if (!hf.ok) {
    log("warn", "HyperFrames CLI not ready", { error: hf.error });
  } else {
    log("info", "HyperFrames CLI ready", { cliPath: hf.cliPath });
  }
});
