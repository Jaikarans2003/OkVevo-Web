import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * @param {object} opts
 * @param {string[]} opts.mp4Paths
 * @param {string} opts.outputPath
 * @returns {Promise<string>}
 */
export function stitchScenes({ mp4Paths, outputPath }) {
  if (mp4Paths.length === 0) {
    return Promise.reject(new Error("No MP4 files to stitch"));
  }

  if (mp4Paths.length === 1) {
    fs.copyFileSync(mp4Paths[0], outputPath);
    return Promise.resolve(outputPath);
  }

  const concatPath = path.join(path.dirname(outputPath), "concat.txt");
  const concatContent = mp4Paths.map((p) => `file '${p}'`).join("\n") + "\n";
  fs.writeFileSync(concatPath, concatContent, "utf-8");

  return new Promise((resolve, reject) => {
    const args = ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", outputPath];
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg concat timed out after 5 minutes"));
    }, FFMPEG_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (code === 0) {
        resolve(outputPath);
        return;
      }

      reject(new Error(stderr.slice(-1000) || `ffmpeg exited with code ${code}`));
    });
  });
}
