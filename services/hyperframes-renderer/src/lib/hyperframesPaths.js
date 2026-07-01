import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Default: N8N/references/hyperframes (this file lives under …/hyperframes/src/lib)
 */
export function defaultHyperframesRepoRoot() {
  return path.resolve(__dirname, "../../../../../references/hyperframes");
}

/**
 * @param {string | undefined} override
 */
export function resolveHyperframesRepoRoot(override) {
  const raw = override?.trim() || process.env.HYPERFRAMES_REPO?.trim();
  if (raw) return path.resolve(raw);
  return defaultHyperframesRepoRoot();
}

/**
 * @param {string} repoRoot
 */
export function resolveCliEntry(repoRoot) {
  const envCli = process.env.HYPERFRAMES_CLI?.trim();
  if (envCli) return path.resolve(envCli);
  return path.join(repoRoot, "packages/cli/dist/cli.js");
}

/**
 * @param {string} cliPath
 */
export function assertCliBuilt(cliPath) {
  if (!fs.existsSync(cliPath)) {
    throw new Error(
      `HyperFrames CLI not found at ${cliPath}. Build the reference repo:\n` +
        `  cd references/hyperframes && bun install && bun run build\n` +
        `Or set HYPERFRAMES_CLI to the path of packages/cli/dist/cli.js`,
    );
  }
}
