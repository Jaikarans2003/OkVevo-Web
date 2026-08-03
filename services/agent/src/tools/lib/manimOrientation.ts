import type { VideoOrientation } from './utils';

/**
 * Arg wins when present (and should be persisted); otherwise session orientation.
 * persist=true only when the tool arg explicitly set orientation.
 */
export function resolveToolOrientation(
  arg: VideoOrientation | undefined,
  session: VideoOrientation
): { orientation: VideoOrientation; persist: boolean } {
  if (arg === 'horizontal' || arg === 'vertical') {
    return { orientation: arg, persist: true };
  }
  return { orientation: session, persist: false };
}

/** Build manim CLI; vertical requires square pixels. */
export function buildManimRenderCmd(opts: {
  scriptPath: string;
  className: string;
  outputDir: string;
  orientation: VideoOrientation;
}): string {
  const parts = [
    'manim',
    'render',
    '-ql',
    ...(opts.orientation === 'vertical' ? ['--resolution', '1080,1080'] : []),
    '--output_file',
    'output.mp4',
    '--media_dir',
    opts.outputDir,
    opts.scriptPath,
    opts.className,
  ];
  return parts.join(' ');
}

/** Vertical scripts must set equal frame_width/height. */
export function assertSquareManimFrame(script: string): string | null {
  const w = script.match(/config\.frame_width\s*=\s*([\d.]+)/);
  const h = script.match(/config\.frame_height\s*=\s*([\d.]+)/);
  if (!w || !h) {
    return 'vertical Manim scripts must set config.frame_width and config.frame_height to equal values (e.g. 8)';
  }
  if (Number(w[1]) !== Number(h[1])) {
    return `vertical Manim frame_width (${w[1]}) must equal frame_height (${h[1]})`;
  }
  return null;
}
