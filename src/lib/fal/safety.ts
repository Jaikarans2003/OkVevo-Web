/**
 * Force Fal's per-request NSFW checker off on image submits.
 * Fal defaults enable_safety_checker to true. Disabling is an input flag;
 * Fal still checks unauthorized accounts (black images). Video untouched.
 */

const CHECKER_OFF = new Set([
  'fal-ai/flux-2/klein/9b',
  'fal-ai/flux-2/klein/9b/edit',
  'fal-ai/flux-2-pro',
  'fal-ai/flux-2-pro/edit',
  'fal-ai/z-image/turbo',
  'fal-ai/qwen-image',
  'fal-ai/qwen-image-2/pro/edit',
  'fal-ai/recraft/v4/pro/text-to-image',
  'fal-ai/recraft/v4.1/text-to-image',
  'bytedance/seedream/v5/lite/text-to-image',
]);

/** Google / Flux Pro have a 1–N knob instead of a boolean off switch. Max = least strict. */
const TOLERANCE_MAX: Record<string, string> = {
  'fal-ai/nano-banana-pro': '6',
  'fal-ai/nano-banana-pro/edit': '6',
  'fal-ai/nano-banana-2': '6',
  'fal-ai/nano-banana-2/edit': '6',
  'fal-ai/flux-2-pro': '5',
  'fal-ai/flux-2-pro/edit': '5',
};

export function applyFalSafetyOff(
  endpoint: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...args };
  if (CHECKER_OFF.has(endpoint)) out.enable_safety_checker = false;
  const tol = TOLERANCE_MAX[endpoint];
  if (tol) out.safety_tolerance = tol;
  return out;
}
