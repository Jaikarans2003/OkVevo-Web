import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { checkDeps } from "./lib/checkDeps.js";
import { detectScenes } from "./lib/detectScenes.js";
import { runManim } from "./lib/runManim.js";
import { stitchScenes } from "./lib/stitchScenes.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/health", (_req, res) => {
  const deps = checkDeps();
  res.json({
    status: deps.allOk ? "ok" : "degraded",
    service: "ManinRenderer",
    version: "1.0.0",
    checks: {
      python: deps.python,
      manim: deps.manim,
      ffmpeg: deps.ffmpeg,
    },
  });
});

router.get("/ready", (_req, res) => {
  const deps = checkDeps();
  if (deps.allOk) {
    res.status(200).json({ ready: true });
    return;
  }
  res.status(503).json({
    ready: false,
    checks: {
      python: deps.python,
      manim: deps.manim,
      ffmpeg: deps.ffmpeg,
    },
  });
});

router.post("/render", upload.single("script"), async (req, res) => {
  let jobId;
  let sceneNames = [];

  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing required field: script" });
      return;
    }

    const scriptContent = req.file.buffer.toString("utf-8");
    sceneNames = detectScenes(scriptContent);

    if (sceneNames.length === 0) {
      res.status(400).json({
        error: "No Scene classes found in script",
        hint: "Class must inherit from Scene, ThreeDScene, MovingCameraScene, or ZoomedScene",
      });
      return;
    }

    const quality = req.body.quality === "draft" ? "draft" : "high";
    jobId = uuidv4();
    const jobDir = path.join("/tmp/manim-jobs", jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const scriptPath = path.join(jobDir, "scene.py");
    fs.writeFileSync(scriptPath, scriptContent, "utf-8");

    console.log(`[render] job started jobId=${jobId} sceneCount=${sceneNames.length}`);

    const manimResult = await runManim({
      scriptPath,
      sceneNames,
      quality,
      jobDir,
    });

    const finalPath = path.join(jobDir, "final.mp4");
    await stitchScenes({ mp4Paths: manimResult.outputPaths, outputPath: finalPath });

    console.log(`[render] job completed jobId=${jobId} sceneCount=${sceneNames.length}`);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=output.mp4");

    const stream = fs.createReadStream(finalPath);
    stream.pipe(res);

    res.on("finish", () => {
      fs.rm(jobDir, { recursive: true, force: true }, () => {});
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "stderr" in err
          ? String(err.stderr)
          : String(err);

    console.error(`[render] job failed jobId=${jobId ?? "unknown"} error=${message}`);

    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: message,
        jobId: jobId ?? null,
        sceneCount: sceneNames.length,
      });
    }
  }
});

router.use((err, _req, res, _next) => {
  if (err && typeof err === "object" && "name" in err && err.name === "MulterError") {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: err.message ?? "upload error", code: err.code });
    return;
  }
  res.status(500).json({ error: err?.message ?? "Internal Server Error" });
});

export default router;
