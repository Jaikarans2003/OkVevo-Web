import { createWriteStream, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Request, Response, NextFunction } from "express";
import Busboy from "busboy";
import { config } from "../config.js";

type UploadedProjectFile = Express.Multer.File;

function rejectUpload(req: Request, res: Response, status: number, code: string, message: string) {
  if (req.hfWorkspace) {
    try {
      rmSync(req.hfWorkspace.sessionDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  if (!res.headersSent) {
    res.status(status).json({ success: false, error: { code, message } });
  }
}

/**
 * Parse multipart for POST /render-project: captures text `options` and streams `project` ZIP.
 * Invalid `options` JSON is rejected on the `field` event (before render when options is sent first).
 */
export function parseProjectMultipart(req: Request, res: Response, next: NextFunction) {
  const ws = req.hfWorkspace;
  if (!ws) {
    next(new Error("missing workspace"));
    return;
  }

  const contentType = req.headers["content-type"];
  if (!contentType?.includes("multipart/form-data")) {
    rejectUpload(req, res, 400, "UPLOAD_ERROR", "Content-Type must be multipart/form-data");
    return;
  }

  const bb = Busboy({
    headers: req.headers,
    limits: { fileSize: config.maxZipBytes, files: 1, fields: 2 },
  });

  let projectFile: UploadedProjectFile | undefined;
  let optionsCaptured = false;
  let pendingFile: Promise<void> = Promise.resolve();
  let uploadError: Error | undefined;
  let aborted = false;

  const abort = (status: number, code: string, message: string) => {
    if (aborted) return;
    aborted = true;
    req.unpipe(bb);
    bb.destroy();
    rejectUpload(req, res, status, code, message);
  };

  bb.on("field", (name, value) => {
    if (name !== "options" || aborted) {
      return;
    }
    const raw = value.trim();
    if (raw) {
      try {
        JSON.parse(raw);
      } catch {
        abort(400, "PROJECT_VALIDATION_FAILED", "Invalid JSON in options multipart field");
        return;
      }
    }
    writeFileSync(join(ws.sessionDir, "options-field.txt"), value, "utf-8");
    optionsCaptured = true;
  });

  bb.on("file", (name, file, info) => {
    if (aborted) {
      file.resume();
      return;
    }
    if (name !== "project") {
      file.resume();
      return;
    }
    if (projectFile) {
      file.resume();
      uploadError = new Error("Multiple project files are not allowed");
      return;
    }

    const dest = join(ws.sessionDir, "inbox.zip");
    const out = createWriteStream(dest);

    pendingFile = pipeline(file, out)
      .then(() => {
        const size = statSync(dest).size;
        projectFile = {
          fieldname: "project",
          originalname: info.filename ?? "project.zip",
          encoding: info.encoding,
          mimetype: info.mimeType ?? "application/zip",
          destination: ws.sessionDir,
          filename: "inbox.zip",
          path: dest,
          size,
        };
      })
      .catch((err) => {
        uploadError = err instanceof Error ? err : new Error(String(err));
      });
  });

  bb.on("error", (err) => {
    if (!aborted) {
      next(err);
    }
  });

  bb.on("close", () => {
    if (aborted) {
      return;
    }
    void pendingFile
      .then(() => {
        if (uploadError) {
          next(uploadError);
          return;
        }
        if (projectFile) {
          req.files = { project: [projectFile] };
        }
        (req as Request & { hfOptionsCaptured?: boolean }).hfOptionsCaptured = optionsCaptured;
        next();
      })
      .catch((err) => {
        if (!aborted) {
          next(err);
        }
      });
  });

  req.pipe(bb);
}
