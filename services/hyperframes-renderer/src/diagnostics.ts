import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, statfsSync } from "node:fs";
import os from "node:os";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { assertCliBuilt, resolveCliEntry } from "./lib/hyperframesPaths.js";

const execFileAsync = promisify(execFile);

export type DependencyCheck = {
  name: string;
  ok: boolean;
  detail?: string;
  version?: string;
};

export type StartupDiagnostics = {
  service: string;
  version: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  uptimeSec: number;
  paths: {
    workRoot: string;
    renderTmpDir: string;
    outputDir: string;
    hyperframesRepo: string;
  };
  limits: {
    maxConcurrentRenders: number;
    maxZipBytes: number;
    renderTimeoutMs: number;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    systemFreeMb: number;
    systemTotalMb: number;
  };
  disk: Record<string, { path: string; freeMb: number; totalMb: number } | { path: string; error: string }>;
  dependencies: DependencyCheck[];
  ready: boolean;
};

async function cmdVersion(bin: string, args: string[]): Promise<DependencyCheck> {
  try {
    const { stdout } = await execFileAsync(bin, args, { timeout: 8000 });
    const first = stdout.split("\n").find((l) => l.trim())?.trim() ?? "ok";
    return { name: bin, ok: true, version: first.slice(0, 200) };
  } catch (e) {
    return {
      name: bin,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function diskStats(path: string) {
  try {
    const s = statfsSync(path);
    const freeMb = Math.floor((s.bfree * s.bsize) / (1024 * 1024));
    const totalMb = Math.floor((s.blocks * s.bsize) / (1024 * 1024));
    return { path, freeMb, totalMb };
  } catch (e) {
    return { path, error: e instanceof Error ? e.message : String(e) };
  }
}

function browserCheck(): DependencyCheck {
  const p =
    process.env.HYPERFRAMES_BROWSER_PATH?.trim() ||
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_BIN?.trim() ||
    "/usr/local/bin/hyperframes-chrome-headless-shell";
  if (!existsSync(p)) {
    return { name: "browser", ok: false, detail: `not found: ${p}` };
  }
  return { name: "browser", ok: true, detail: p };
}

export async function collectStartupDiagnostics(): Promise<StartupDiagnostics> {
  const mem = process.memoryUsage();
  const deps: DependencyCheck[] = [
    await cmdVersion("ffmpeg", ["-version"]),
    await cmdVersion("ffprobe", ["-version"]),
    await cmdVersion("zip", ["-v"]),
    browserCheck(),
  ];

  try {
    const cliPath = resolveCliEntry(config.hyperframesRepo);
    assertCliBuilt(cliPath);
    deps.push({ name: "hyperframes-cli", ok: true, detail: cliPath });
  } catch (e) {
    deps.push({
      name: "hyperframes-cli",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const ready = deps.every((d) => d.ok);

  return {
    service: config.serviceName,
    version: config.version,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    paths: {
      workRoot: config.workRoot,
      renderTmpDir: config.renderTmpDir,
      outputDir: config.outputDir,
      hyperframesRepo: config.hyperframesRepo,
    },
    limits: {
      maxConcurrentRenders: config.maxConcurrentRenders,
      maxZipBytes: config.maxZipBytes,
      renderTimeoutMs: config.renderTimeoutMs,
    },
    memory: {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      systemFreeMb: Math.round(os.freemem() / (1024 * 1024)),
      systemTotalMb: Math.round(os.totalmem() / (1024 * 1024)),
    },
    disk: {
      workRoot: diskStats(config.workRoot),
      outputDir: diskStats(config.outputDir),
    },
    dependencies: deps,
    ready,
  };
}

export async function logStartupDiagnostics(): Promise<StartupDiagnostics> {
  const diag = await collectStartupDiagnostics();
  const level = diag.ready ? "info" : "warn";
  logger[level]({ startupDiagnostics: diag }, "HyperFrames renderer startup diagnostics");
  for (const dep of diag.dependencies) {
    if (dep.ok) {
      logger.info({ dependency: dep.name, version: dep.version, detail: dep.detail }, "dependency ok");
    } else {
      logger.warn({ dependency: dep.name, detail: dep.detail }, "dependency missing");
    }
  }
  return diag;
}
