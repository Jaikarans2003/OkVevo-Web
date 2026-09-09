/**
 * Meterable Fal endpoints for OkVevo proxy. Exact ids only.
 *
 * Relationship to media-catalog.json: every catalog row with shipped:true
 * must be present here (mediaCatalog.selfcheck.ts enforces). This set is a
 * superset — code-default models that are not in Karan's catalog (Klein,
 * Pixverse, Veo, LTX 2.3, Kling v3 4K, …) stay meterable for as long as the
 * tools ship them as defaults. SeedVR upscale is metered here but is an
 * upscale= pass, not a catalog generate mode.
 */

export const METERABLE_ENDPOINTS = new Set<string>([
  'fal-ai/nano-banana-pro',
  'fal-ai/nano-banana-pro/edit',
  'fal-ai/nano-banana-2',
  'fal-ai/nano-banana-2/edit',
  'fal-ai/ideogram/v3',
  'fal-ai/ideogram/v3/edit',
  'fal-ai/recraft/v4/pro/text-to-image',
  'fal-ai/recraft/v4.1/text-to-image',
  'bytedance/seedream/v5/lite/text-to-image',
  'fal-ai/qwen-image-2/pro/edit',
  'fal-ai/flux-2/klein/9b',
  'fal-ai/flux-2/klein/9b/edit',
  'fal-ai/flux-2-pro',
  'fal-ai/flux-2-pro/edit',
  'fal-ai/z-image/turbo',
  'fal-ai/qwen-image',
  'fal-ai/pixverse/v6/text-to-video',
  'fal-ai/pixverse/v6/image-to-video',
  'fal-ai/veo3.1',
  'fal-ai/veo3.1/image-to-video',
  'minimax/h3/text-to-video',
  'minimax/h3/image-to-video',
  'minimax/h3-max/text-to-video',
  'minimax/h3-max/image-to-video',
  'blackforestlabs/flux-3/text-to-video',
  'blackforestlabs/flux-3/image-to-video',
  'xai/grok-imagine-video/v1.5/text-to-video',
  'xai/grok-imagine-video/v1.5/image-to-video',
  'fal-ai/kling-video/v3/4k/text-to-video',
  'fal-ai/kling-video/v3/4k/image-to-video',
  'alibaba/happy-horse/text-to-video',
  'bytedance/seedance-2.0/mini/text-to-video',
  'bytedance/seedance-2.0/mini/image-to-video',
  'bytedance/seedance-2.0/text-to-video',
  'bytedance/seedance-2.0/image-to-video',
  'bytedance/seedance-2.5/text-to-video',
  'bytedance/seedance-2.5/image-to-video',
  'fal-ai/ltx-2.3-22b/text-to-video',
  'fal-ai/ltx-2.3-22b/image-to-video',
  'fal-ai/seedvr/upscale/video',
]);

export function isMeterableEndpoint(endpoint: string): boolean {
  return METERABLE_ENDPOINTS.has(endpoint.trim());
}
