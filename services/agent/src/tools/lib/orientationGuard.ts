import type { VideoOrientation } from './utils';

/** Parse #stage / body canvas size from composition HTML. */
export function parseStageCanvasSize(
  html: string
): { width: number; height: number } | null {
  const stageData = html.match(
    /id=["']stage["'][^>]*data-width=["'](\d+)["'][^>]*data-height=["'](\d+)["']/i
  );
  if (stageData) {
    return { width: Number(stageData[1]), height: Number(stageData[2]) };
  }
  const stageDataAlt = html.match(
    /id=["']stage["'][^>]*data-height=["'](\d+)["'][^>]*data-width=["'](\d+)["']/i
  );
  if (stageDataAlt) {
    return { width: Number(stageDataAlt[2]), height: Number(stageDataAlt[1]) };
  }
  const css = html.match(
    /#stage\s*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px/i
  );
  if (css) return { width: Number(css[1]), height: Number(css[2]) };
  const body = html.match(
    /html,\s*body\s*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px/i
  );
  if (body) return { width: Number(body[1]), height: Number(body[2]) };
  return null;
}

export function assertHtmlMatchesOrientation(
  html: string,
  orientation: VideoOrientation,
  expected: { width: number; height: number }
): void {
  const parsed = parseStageCanvasSize(html);
  if (!parsed) {
    throw new Error(
      `Composition HTML has no readable #stage/body size. Re-run scaffold_hf_project with orientation=${orientation} — do not patch meta/CSS alone.`
    );
  }
  if (parsed.width !== expected.width || parsed.height !== expected.height) {
    throw new Error(
      `Composition HTML stage is ${parsed.width}×${parsed.height} but session orientation is ${orientation} (${expected.width}×${expected.height}). Re-run scaffold_hf_project with the matching orientation template — do not patch meta/CSS alone.`
    );
  }
}

/** Soft note when Manim pixel aspect disagrees with session orientation pod. */
export function manimFitNoteForClip(
  orientation: VideoOrientation,
  width: number,
  height: number
): string | null {
  if (!(width > 0 && height > 0)) return null;
  const ratio = width / height;
  if (orientation === 'vertical' && ratio > 1.2) {
    return `Manim clip is landscape (${width}×${height}) in a vertical (square) pod — object-fit:contain will letterbox. Regenerate that concept with orientation=vertical only if cramped.`;
  }
  if (orientation === 'horizontal' && ratio < 1.2) {
    return `Manim clip is square/portrait (${width}×${height}) in a horizontal 16:9 pod — object-fit:contain will pillarbox. Regenerate that concept with orientation=horizontal only if cramped.`;
  }
  return null;
}
