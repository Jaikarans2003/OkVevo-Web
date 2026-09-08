/**
 * Live Fal `unit` quantity. Switch on the API unit string, not a guessed category.
 * `seconds` is output duration — never metrics.inference_time / timings.
 */

export class QuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuantityError';
  }
}

const IMAGE_SIZE_PRESETS: Record<string, { width: number; height: number }> = {
  square_hd: { width: 1024, height: 1024 },
  square: { width: 512, height: 512 },
  portrait_4_3: { width: 768, height: 1024 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1024, height: 576 },
};

const RESOLUTION_PX: Record<string, { width: number; height: number }> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '768p': { width: 1366, height: 768 },
  '1080p': { width: 1920, height: 1080 },
  '2k': { width: 2048, height: 1080 },
  '4k': { width: 3840, height: 2160 },
  '2160p': { width: 3840, height: 2160 },
};

export type QuantityInput = {
  unit: string;
  endpoint?: string;
  args?: Record<string, unknown>;
  payload?: unknown;
  /** Present so tests prove we ignore them for unit === "seconds". */
  metrics?: unknown;
  timings?: unknown;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function positiveInt(n: number): number | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === 'number') return positiveInt(Math.round(value));
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  if (!t || t === 'auto') return null;
  const m = /^(\d+(?:\.\d+)?)s?$/.exec(t);
  if (!m) return null;
  return positiveInt(Math.round(Number(m[1])));
}

function dimFromSize(value: unknown): { width: number; height: number } | null {
  if (typeof value === 'string') {
    const preset = IMAGE_SIZE_PRESETS[value.trim().toLowerCase()];
    if (preset) return preset;
    const m = /^(\d+)\s*x\s*(\d+)$/i.exec(value.trim());
    if (m) {
      const width = Number(m[1]);
      const height = Number(m[2]);
      if (width > 0 && height > 0) return { width, height };
    }
    const res = RESOLUTION_PX[value.trim().toLowerCase()];
    if (res) return res;
    return null;
  }
  const rec = asRecord(value);
  if (!rec) return null;
  const width = Number(rec.width);
  const height = Number(rec.height);
  if (width > 0 && height > 0) return { width, height };
  return null;
}

function imageCount(args: Record<string, unknown>, payload: unknown): number {
  const p = asRecord(payload);
  if (p && Array.isArray(p.images) && p.images.length > 0) return p.images.length;
  const n = Number(args.num_images);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 1;
}

function imageDims(
  args: Record<string, unknown>,
  payload: unknown
): { width: number; height: number } {
  const p = asRecord(payload);
  if (p && Array.isArray(p.images)) {
    const first = asRecord(p.images[0]);
    const d = first ? dimFromSize(first) : null;
    if (d) return d;
  }
  const fromArgs =
    dimFromSize(args.image_size) ||
    dimFromSize(args.image_size_preset) ||
    dimFromSize({ width: args.width, height: args.height });
  if (fromArgs) return fromArgs;
  return { width: 1024, height: 1024 };
}

function videoDims(args: Record<string, unknown>, payload: unknown): { width: number; height: number } {
  const p = asRecord(payload);
  const video = p ? asRecord(p.video) : null;
  const fromPayload = video ? dimFromSize(video) : null;
  if (fromPayload) return fromPayload;
  const fromArgs =
    dimFromSize(args.resolution) ||
    dimFromSize({ width: args.width, height: args.height }) ||
    dimFromSize(args.image_size);
  if (fromArgs) return fromArgs;
  return RESOLUTION_PX['720p'];
}

function videoFrames(args: Record<string, unknown>, payload: unknown): number {
  const p = asRecord(payload);
  const video = p ? asRecord(p.video) : null;
  const fromPayload = Number(video?.num_frames ?? p?.num_frames);
  if (fromPayload > 0) return Math.floor(fromPayload);
  const fromArgs = Number(args.num_frames);
  if (fromArgs > 0) return Math.floor(fromArgs);
  const duration = outputDurationSeconds(args, payload) ?? 5;
  return Math.max(1, Math.round(duration * 24) + 1);
}

function outputDurationSeconds(args: Record<string, unknown>, payload: unknown): number | null {
  const requested = parseDurationSeconds(args.duration);
  if (requested != null) return requested;
  const p = asRecord(payload);
  const video = p ? asRecord(p.video) : null;
  return parseDurationSeconds(video?.duration ?? p?.duration);
}

function isLtxVideo(endpoint: string): boolean {
  return endpoint.includes('ltx-2.3') || endpoint.includes('ltx-video');
}

function megapixels(width: number, height: number, frames?: number): number {
  const px = frames && frames > 0 ? width * height * frames : width * height;
  return px / 1e6;
}

/**
 * Quantity for live `unit`. Throws QuantityError for units we refuse to guess.
 * Hard rule: unit === "seconds" never reads inference_time / timings.
 */
export function quantity(input: QuantityInput): number {
  const unit = input.unit.trim().toLowerCase();
  const args = input.args ?? {};
  const endpoint = input.endpoint ?? '';

  if (unit === 'seconds') {
    // Do not read input.metrics / input.timings — wall-clock is not a billing unit.
    const seconds = outputDurationSeconds(args, input.payload);
    if (seconds == null) {
      throw new QuantityError('seconds unit needs output duration, not inference_time');
    }
    return seconds;
  }

  if (unit === 'images') {
    return imageCount(args, input.payload);
  }

  if (unit === 'megapixels' || unit === 'processed megapixels') {
    if (isLtxVideo(endpoint) || endpoint.includes('seedvr/upscale/video')) {
      const { width, height } = videoDims(args, input.payload);
      const frames = videoFrames(args, input.payload);
      return Math.ceil(megapixels(width, height, frames));
    }
    const { width, height } = imageDims(args, input.payload);
    const n = imageCount(args, input.payload);
    return megapixels(width, height) * n;
  }

  if (unit === '1000 tokens') {
    const { width, height } = videoDims(args, input.payload);
    const duration = outputDurationSeconds(args, input.payload);
    if (duration == null) {
      throw new QuantityError('1000 tokens unit needs output duration');
    }
    return (height * width * duration * 24) / 1024 / 1000;
  }

  if (unit === 'compute seconds') {
    throw new QuantityError('compute seconds is not meterable in 6a');
  }

  if (unit === 'units' || unit === 'credits') {
    throw new QuantityError(`refusing to guess quantity for unit=${input.unit}`);
  }

  throw new QuantityError(`unknown Fal unit: ${input.unit}`);
}

/** Page multipliers after unit_price × quantity. */
export function adjustedUsd(opts: {
  endpoint: string;
  args: Record<string, unknown>;
  unitPrice: number;
  qty: number;
}): number {
  const { endpoint, args, unitPrice, qty } = opts;
  let usd = unitPrice * qty;

  if (endpoint.startsWith('fal-ai/veo3.1')) {
    // API $0.40/s = with-audio 720/1080. Page: no-audio $0.20, 4K $0.40/$0.60.
    const audio = args.generate_audio !== false && args.generate_audio !== 'false';
    const res = String(args.resolution ?? '').toLowerCase();
    const is4k = res === '4k' || res === '2160p';
    if (is4k) usd = audio ? unitPrice * qty * (0.6 / 0.4) : unitPrice * qty;
    else if (!audio) usd = unitPrice * qty * (0.2 / 0.4);
  }

  if (endpoint.startsWith('fal-ai/nano-banana-pro')) {
    const res = String(args.resolution ?? args.image_size ?? '').toLowerCase();
    if (res.includes('4k')) usd *= 2;
    if (args.enable_web_search === true || args.web_search === true) {
      usd += 0.015 * (Number(args.num_images) > 0 ? Number(args.num_images) : 1);
    }
  }

  return usd;
}
