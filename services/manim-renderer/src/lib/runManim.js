import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MANIM_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * @param {object} opts
 * @param {string} opts.scriptPath
 * @param {string[]} opts.sceneNames
 * @param {string} [opts.quality]
 * @param {string} opts.jobDir
 * @returns {Promise<{ success: true, outputPaths: string[] }>}
 */
export function runManim({ scriptPath, sceneNames, quality, jobDir }) {
  const qualityFlag = quality === "draft" ? "-ql" : "-qh";
  const args = ["render", qualityFlag, "--output_file", "output.mp4", scriptPath, ...sceneNames];

  return new Promise((resolve, reject) => {
    const child = spawn("manim", args, {
      cwd: jobDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject({
        success: false,
        stderr: "Manim render timed out after 10 minutes",
        exitCode: -1,
      });
    }, MANIM_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject({
        success: false,
        stderr: err.message,
        exitCode: -1,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (code === 0) {
        const outputPaths = walkDir(jobDir)
          .filter((p) => p.endsWith(".mp4"))
          .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

        resolve({ success: true, outputPaths });
        return;
      }

      reject({
        success: false,
        stderr: stderr.slice(-1000),
        exitCode: code ?? -1,
      });
    });
  });
}
