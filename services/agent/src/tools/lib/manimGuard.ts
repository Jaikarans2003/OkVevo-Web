// @ts-nocheck
/** Reject Manim scripts that raise MAX_VISIBLE or strip VisibleTracker. */

const SCENE_CLASS_RE = /class\s+Scene\w*\s*\(\s*Scene\s*\)\s*:/;
const TRACKER_REMOVED =
  'Anti-overlap tracking (VisibleTracker) was removed from this script — it must remain wired in; fix the layout, don\'t delete the safety check.';

export function assertManimMaxVisible(content: string): string | null {
  // null = ok; string = actionable error for the agent
  if (/\bMAX_VISIBLE\s*=/.test(content) && !/\bMAX_VISIBLE\s*=\s*6\b/.test(content)) {
    return 'MAX_VISIBLE must remain 6 (immutable). Do not raise it — Group related mobjects, FadeOut spent labels/rects, or clear_scene between beats, then retry.';
  }
  if (SCENE_CLASS_RE.test(content)) {
    if (!/\bVisibleTracker\b/.test(content) || !/\.check\s*\(/.test(content)) {
      return TRACKER_REMOVED;
    }
  }
  return null;
}

export function isManimScriptPath(resolvedPath: string): boolean {
  return /[/\\]manim_scripts[/\\].+\.py$/i.test(resolvedPath);
}
