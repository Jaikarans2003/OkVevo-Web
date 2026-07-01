import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveCliEntry, assertCliBuilt } from "./hyperframesPaths.js";

/**
 * Single Chrome/Chromium path for HyperFrames CLI + Puppeteer + shell hooks.
 * Resolves symlinks (Docker uses /usr/local/bin/hyperframes-chrome-headless-shell → real binary).
 *
 * @returns {string} absolute executable path, or "" when we should not override (non-Linux local dev)
 */
function resolveHyperframesBrowserExecutable() {
  const fromEnv =
    process.env.HYPERFRAMES_BROWSER_PATH?.trim() ||
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_BIN?.trim();

  if (fromEnv) {
    try {
      return fs.realpathSync(fromEnv);
    } catch {
      return fromEnv;
    }
  }

  if (os.platform() === "linux" && process.arch === "arm64") {
    try {
      return fs.realpathSync("/usr/bin/chromium");
    } catch {
      return "/usr/bin/chromium";
    }
  }

  if (os.platform() === "linux") {
    try {
      return fs.realpathSync("/usr/local/bin/hyperframes-chrome-headless-shell");
    } catch {
      return "/usr/local/bin/hyperframes-chrome-headless-shell";
    }
  }

  return "";
}

/**
 * @param {object} opts
 * @param {string} opts.repoRoot
 * @param {string} opts.projectDir
 * @param {string} opts.outputFile absolute path to mp4
 * @param {string} [opts.quality]
 * @param {string[]} [opts.extraArgs] extra CLI flags (e.g. --fps, -c)
 */
export function runHyperframesRender({ repoRoot, projectDir, outputFile, quality = "draft", extraArgs = [] }) {
  const cliPath = resolveCliEntry(repoRoot);
  assertCliBuilt(cliPath);

  const args = ["render", "--output", outputFile, "--quality", quality, "--quiet", ...extraArgs];

  const browserExe = resolveHyperframesBrowserExecutable();
  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
  };
  if (browserExe) {
    env.HYPERFRAMES_BROWSER_PATH = browserExe;
    env.PUPPETEER_EXECUTABLE_PATH = browserExe;
    env.CHROME_BIN = browserExe;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: projectDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        if (!fs.existsSync(outputFile)) {
          reject(new Error("Render reported success but output file is missing"));
          return;
        }
        resolve({ stdout, stderr });
        return;
      }
      const err = new Error(`hyperframes render exited with code ${code}`);
      err.code = "RENDER_FAILED";
      err.stderr = stderr;
      err.stdout = stdout;
      reject(err);
    });
  });
}

/**
 * @param {string} outputDir
 * @param {string} jobId
 */
export function outputVideoPath(outputDir, jobId) {
  return path.join(outputDir, `render-${jobId}.mp4`);
}
