import { execSync } from "node:child_process";

/** @type {{ python: boolean, manim: boolean, ffmpeg: boolean, allOk: boolean } | null} */
let cached = null;

function checkCommand(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {{ python: boolean, manim: boolean, ffmpeg: boolean, allOk: boolean }}
 */
export function checkDeps() {
  if (cached) {
    return cached;
  }

  const python = checkCommand("python3 --version");
  const manim = checkCommand("manim --version");
  const ffmpeg = checkCommand("ffmpeg -version");
  const allOk = python && manim && ffmpeg;

  cached = { python, manim, ffmpeg, allOk };
  return cached;
}
