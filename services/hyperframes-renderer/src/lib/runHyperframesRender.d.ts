export function runHyperframesRender(opts: {
  repoRoot: string;
  projectDir: string;
  outputFile: string;
  quality?: string;
  extraArgs?: string[];
}): Promise<{ stdout: string; stderr: string }>;

export function outputVideoPath(outputDir: string, jobId: string): string;
