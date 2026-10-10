/**
 * Drama Fal rate card. Charge path for model-map ids.
 * CARD ids never read a live price. HYBRID/LIVE read one unit price,
 * then bounds and the card. Plain h3 and seedance-2.0-mini are absent
 * on purpose — they stay on the legacy live meter.
 */

export const MAX_JOB_CREDITS = 70_000;
export const LIVE_TTL_MS = 10 * 60 * 1000;
export const LAST_KNOWN_GOOD_MS = 60 * 60 * 1000;
export const QUOTE_TTL_MS = 15 * 60 * 1000;
export const PRICE_BOUNDS = { low: 0.2, high: 3 } as const;

/** H3 Max text/image promo. Assumption: ends 2026-10-15T00:00:00Z. Reference has no promo. */
export const H3_PROMO_ENDS_AT = '2026-10-15T00:00:00.000Z';

export const H3_REF_FREE_TOKENS = 4096;
export const H3_REF_USD_PER_1K = 0.02;
/**
 * ponytail: pricing API has no per-image token count. 1024 tokens per square
 * ref makes 5s 768p reference + 5 refs = $0.42048 at the regular (no-promo)
 * 768p rate. Upgrade: replace with billing-events quantity.
 */
export const H3_SQUARE_IMAGE_TOKENS = 1024;

export const SPEECH_MAX_CHARS = 5000;
export const MUSIC_MAX_SECONDS = 300;
export const GPT_IMAGE_MAX_REFS = 16;

export type PriceSource = 'card' | 'hybrid' | 'live';

export type PriceSnapshot = {
  endpoint: string;
  unit: string;
  unitPrice: number;
  source: PriceSource | 'card-fallback';
  fetchedAt: string;
  rawUsd: number;
};

type Tier = { regular: number; promo?: number };

const H3_TIERS: Record<string, Tier> = {
  '480p': { regular: 0.05, promo: 0.03 },
  '768p': { regular: 0.08, promo: 0.048 },
  '1080p': { regular: 0.16, promo: 0.096 },
};

const WAN_TIERS: Record<string, number> = {
  '480p': 0.068,
  '720p': 0.14,
  '1080p': 0.28,
};

/** size key "WxH" → quality → USD. Missing cells are rejected, not guessed. */
const GPT_IMAGE_USD: Record<string, Partial<Record<'low' | 'medium' | 'high', number>>> = {
  '1024x1024': { low: 0.006, medium: 0.053, high: 0.211 },
  '1920x1080': { high: 0.158 },
  '3840x2160': { high: 0.401 },
};

const SEEDANCE_20 = [
  'bytedance/seedance-2.0/text-to-video',
  'bytedance/seedance-2.0/image-to-video',
  'bytedance/seedance-2.0/reference-to-video',
] as const;

const SEEDANCE_25 = [
  'bytedance/seedance-2.5/text-to-video',
  'bytedance/seedance-2.5/image-to-video',
  'bytedance/seedance-2.5/reference-to-video',
] as const;

const H3_MAX = [
  'minimax/h3-max/text-to-video',
  'minimax/h3-max/image-to-video',
  'minimax/h3-max/reference-to-video',
] as const;

const WAN = [
  'alibaba/wan-3.0-prime/text-to-video',
  'alibaba/wan-3.0-prime/image-to-video',
  'alibaba/wan-3.0-prime/reference-to-video',
] as const;

export const RATE_CARD_IDS = [
  ...SEEDANCE_20,
  ...SEEDANCE_25,
  ...H3_MAX,
  ...WAN,
  'openai/gpt-image-2',
  'openai/gpt-image-2/edit',
  'minimax/music-3',
  'fal-ai/minimax/speech-02-hd',
] as const;

const CARD_BASE: Record<string, { source: PriceSource; unit: string; base: number }> = {};
for (const id of SEEDANCE_20) CARD_BASE[id] = { source: 'hybrid', unit: '1000 tokens', base: 0.014 };
for (const id of SEEDANCE_25) CARD_BASE[id] = { source: 'hybrid', unit: '1000 tokens', base: 0.0214 };
for (const id of H3_MAX) CARD_BASE[id] = { source: 'card', unit: 'seconds', base: 0.05 };
for (const id of WAN) CARD_BASE[id] = { source: 'card', unit: 'seconds', base: 0.068 };
CARD_BASE['openai/gpt-image-2'] = { source: 'card', unit: 'units', base: 0.211 };
CARD_BASE['openai/gpt-image-2/edit'] = { source: 'card', unit: 'units', base: 0.211 };
CARD_BASE['minimax/music-3'] = { source: 'live', unit: 'seconds', base: 0.002 };
CARD_BASE['fal-ai/minimax/speech-02-hd'] = { source: 'live', unit: '1000 characters', base: 0.1 };

export function rateCardEntry(endpoint: string) {
  return CARD_BASE[endpoint.trim()] ?? null;
}

export function isLegacyLiveEndpoint(endpoint: string): boolean {
  const id = endpoint.trim();
  return id.startsWith('minimax/h3/') || id.startsWith('bytedance/seedance-2.0/mini/');
}

export class RateCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateCardError';
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function normalizeResolution(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase().replace(/p$/, 'p');
  if (t === '480p' || t === '720p' || t === '768p' || t === '1080p' || t === '4k' || t === '2160p') {
    return t === '2160p' ? '4k' : t;
  }
  return null;
}

function resolutionOrThrow(args: Record<string, unknown>): string {
  const res = normalizeResolution(args.resolution);
  if (!res) throw new RateCardError('resolution is required');
  return res;
}

function secondsOrThrow(args: Record<string, unknown>, payload?: unknown): number {
  const payloadRec = asRecord(payload);
  const video = payloadRec ? asRecord(payloadRec.video) : null;
  const raw = video?.duration ?? payloadRec?.duration ?? args.duration;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) throw new RateCardError('duration is required');
  return n;
}

/** (height × width × seconds × 24) / 1024 / 1000 — same formula as quantity.ts. */
export function seedanceKTokens(width: number, height: number, seconds: number): number {
  return (height * width * seconds * 24) / 1024 / 1000;
}

const RES_PX: Record<string, { width: number; height: number }> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '768p': { width: 1366, height: 768 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

function videoPx(args: Record<string, unknown>): { width: number; height: number } {
  const w = Number(args.width);
  const h = Number(args.height);
  if (w > 0 && h > 0) return { width: w, height: h };
  const res = resolutionOrThrow(args);
  const px = RES_PX[res];
  if (!px) throw new RateCardError(`no pixel size for resolution ${res}`);
  return px;
}

export function h3PromoActive(nowMs: number): boolean {
  return nowMs < Date.parse(H3_PROMO_ENDS_AT);
}

export function h3SecondPrice(resolution: string, nowMs: number, reference: boolean): number {
  const tier = H3_TIERS[resolution];
  if (!tier) throw new RateCardError(`h3-max has no price for ${resolution}`);
  if (!reference && tier.promo != null && h3PromoActive(nowMs)) return tier.promo;
  return tier.regular;
}

export function h3RefSurchargeUsd(squareRefs: number): number {
  if (!Number.isInteger(squareRefs) || squareRefs < 0) {
    throw new RateCardError('reference image count is invalid');
  }
  const tokens = squareRefs * H3_SQUARE_IMAGE_TOKENS;
  const billable = Math.max(0, tokens - H3_REF_FREE_TOKENS);
  return (billable / 1000) * H3_REF_USD_PER_1K;
}

function squareRefCount(args: Record<string, unknown>): number {
  const n = Number(args.reference_image_count ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new RateCardError('reference image count is invalid');
  return Math.floor(n);
}

function seedanceRatio(endpoint: string, resolution: string): number {
  if (endpoint.includes('seedance-2.0/') && resolution === '4k') return 0.008 / 0.014;
  if (endpoint.includes('seedance-2.5/') && resolution === '1080p') return 0.0234 / 0.0214;
  return 1;
}

function imageSizeKey(args: Record<string, unknown>): string {
  const size = args.image_size ?? args.size;
  if (typeof size === 'string') {
    const m = /^(\d+)\s*x\s*(\d+)$/i.exec(size.trim());
    if (m) return `${m[1]}x${m[2]}`;
    if (size === 'square_hd' || size === 'square') return '1024x1024';
  }
  const rec = asRecord(size);
  if (rec && Number(rec.width) > 0 && Number(rec.height) > 0) {
    return `${rec.width}x${rec.height}`;
  }
  const w = Number(args.width);
  const h = Number(args.height);
  if (w > 0 && h > 0) return `${w}x${h}`;
  return '1024x1024';
}

function imageQuality(args: Record<string, unknown>): 'low' | 'medium' | 'high' {
  const q = typeof args.quality === 'string' ? args.quality.trim().toLowerCase() : 'high';
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  throw new RateCardError(`quality ${q} is not on the gpt-image-2 card`);
}

export function livePriceUsable(live: number | null, cardBase: number): live is number {
  if (live == null || !(live > 0) || !(cardBase > 0)) return false;
  const ratio = live / cardBase;
  return ratio >= PRICE_BOUNDS.low && ratio <= PRICE_BOUNDS.high;
}

export function livePriceIsFresh(fetchedAtMs: number, nowMs: number): boolean {
  return nowMs - fetchedAtMs >= 0 && nowMs - fetchedAtMs <= LIVE_TTL_MS;
}

export type ResolveInput = {
  endpoint: string;
  args: Record<string, unknown>;
  payload?: unknown;
  /** Live unit price. Ignored for source=card. */
  liveUnitPrice?: number | null;
  liveFetchedAtMs?: number | null;
  nowMs: number;
};

export type ResolveResult = {
  rawUsd: number;
  snapshot: PriceSnapshot;
  /** Set when a live price was ignored. Caller alerts; charge is never 0. */
  alert?: string;
};

export function resolveRateCard(input: ResolveInput): ResolveResult {
  const endpoint = input.endpoint.trim();
  const card = rateCardEntry(endpoint);
  if (!card) throw new RateCardError(`no rate card for ${endpoint}`);
  const args = input.args ?? {};
  const nowIso = new Date(input.nowMs).toISOString();

  const useLive = (): { price: number; source: PriceSnapshot['source']; alert?: string } => {
    const fresh =
      input.liveFetchedAtMs != null && livePriceIsFresh(input.liveFetchedAtMs, input.nowMs);
    const known =
      input.liveFetchedAtMs != null &&
      input.nowMs - input.liveFetchedAtMs <= LAST_KNOWN_GOOD_MS;
    const live = input.liveUnitPrice ?? null;
    if ((fresh || known) && livePriceUsable(live, card.base)) {
      return { price: live, source: card.source };
    }
    if (live != null && !livePriceUsable(live, card.base)) {
      return {
        price: card.base,
        source: 'card-fallback',
        alert: `live price for ${endpoint} ignored; using card ${card.base}`,
      };
    }
    return {
      price: card.base,
      source: 'card-fallback',
      alert: live == null ? `live price missing for ${endpoint}; using card ${card.base}` : undefined,
    };
  };

  let rawUsd = 0;
  let unitPrice = card.base;
  let source: PriceSnapshot['source'] = card.source;
  let alert: string | undefined;

  if (card.source === 'hybrid') {
    const picked = useLive();
    unitPrice = picked.price;
    source = picked.source;
    alert = picked.alert;
    const px = videoPx(args);
    const seconds = secondsOrThrow(args, input.payload);
    const ratio = seedanceRatio(endpoint, normalizeResolution(args.resolution) ?? '720p');
    rawUsd = seedanceKTokens(px.width, px.height, seconds) * unitPrice * ratio;
  } else if (endpoint.startsWith('minimax/h3-max/')) {
    const res = resolutionOrThrow(args);
    const seconds = secondsOrThrow(args, input.payload);
    const reference = endpoint.endsWith('/reference-to-video');
    unitPrice = h3SecondPrice(res, input.nowMs, reference);
    rawUsd = unitPrice * seconds;
    if (reference || squareRefCount(args) > 0) rawUsd += h3RefSurchargeUsd(squareRefCount(args));
    source = 'card';
  } else if (endpoint.startsWith('alibaba/wan-3.0-prime/')) {
    const res = resolutionOrThrow(args);
    const per = WAN_TIERS[res];
    if (per == null) throw new RateCardError(`wan has no price for ${res}`);
    const seconds = secondsOrThrow(args, input.payload);
    unitPrice = per;
    rawUsd = per * seconds;
    source = 'card';
  } else if (endpoint === 'openai/gpt-image-2' || endpoint === 'openai/gpt-image-2/edit') {
    const key = imageSizeKey(args);
    const quality = imageQuality(args);
    const cell = GPT_IMAGE_USD[key]?.[quality];
    if (cell == null) throw new RateCardError(`gpt-image-2 has no price for ${key} ${quality}`);
    const images = Math.max(1, Math.floor(Number(args.num_images) || 1));
    const refs = squareRefCount(args);
    if (endpoint.endsWith('/edit') && refs > GPT_IMAGE_MAX_REFS) {
      throw new RateCardError(`gpt-image-2 edit accepts at most ${GPT_IMAGE_MAX_REFS} reference images`);
    }
    unitPrice = cell;
    // Input-image token count is unverified ($8/1M is on the Fal page; tokens per image are not).
    rawUsd = cell * images;
    source = 'card';
  } else if (endpoint === 'minimax/music-3') {
    const picked = useLive();
    unitPrice = picked.price;
    source = picked.source;
    alert = picked.alert;
    const requested = args.duration == null ? MUSIC_MAX_SECONDS : secondsOrThrow(args, input.payload);
    const seconds = Math.min(MUSIC_MAX_SECONDS, requested);
    rawUsd = unitPrice * seconds;
  } else if (endpoint === 'fal-ai/minimax/speech-02-hd') {
    const text = typeof args.text === 'string' ? args.text : '';
    if (!text.trim()) throw new RateCardError('speech text is required');
    if (text.length > SPEECH_MAX_CHARS) {
      throw new RateCardError(`speech text exceeds ${SPEECH_MAX_CHARS} characters`);
    }
    const picked = useLive();
    unitPrice = picked.price;
    source = picked.source;
    alert = picked.alert;
    rawUsd = unitPrice * (text.length / 1000);
  } else {
    throw new RateCardError(`no rate card for ${endpoint}`);
  }

  if (!(rawUsd > 0)) throw new RateCardError('refusing a zero price');

  return {
    rawUsd,
    alert,
    snapshot: {
      endpoint,
      unit: card.unit,
      unitPrice,
      source,
      fetchedAt: nowIso,
      rawUsd,
    },
  };
}

/** Settle from the stored snapshot. Never reads a new live price. */
export function settleFromSnapshot(opts: {
  snapshot: PriceSnapshot;
  args: Record<string, unknown>;
  payload?: unknown;
  nowMs: number;
}): number {
  const again = resolveRateCard({
    endpoint: opts.snapshot.endpoint,
    args: opts.args,
    payload: opts.payload,
    liveUnitPrice: opts.snapshot.unitPrice,
    liveFetchedAtMs: Date.parse(opts.snapshot.fetchedAt),
    nowMs: opts.nowMs,
  });
  return again.rawUsd;
}

export const MARGIN_REVENUE_ASSUMPTION =
  'ASSUMPTION: notional revenue = credits / PLACEHOLDER_CREDITS_PER_USD (1000). ' +
  'Not settled cash — the constant is still a placeholder, free grants have no price, ' +
  'and INR checkout uses a book FX peg.';

export const MARGIN_ALERT_THRESHOLD = 0.45;

/** Realized margin on the face rate. Null when credits are not positive. */
export function realizedMargin(falBilledUsd: number, creditsCharged: number): number | null {
  if (!(creditsCharged > 0) || !Number.isFinite(falBilledUsd)) return null;
  const notionalRevenue = creditsCharged / 1000;
  if (!(notionalRevenue > 0)) return null;
  return 1 - falBilledUsd / notionalRevenue;
}

export type DriftLevel = 'HIGH' | 'INFO' | 'ok';

export type DriftLine = {
  endpoint: string;
  level: DriftLevel;
  note: string;
};

const DRIFT_TOLERANCE = 0.1;

/** Live-expressible comparison only. Card-tier ids are reported, not charged from live. */
export function priceDrift(opts: {
  nowMs: number;
  liveByEndpoint: Record<string, number | null>;
}): DriftLine[] {
  const lines: DriftLine[] = [];
  for (const id of RATE_CARD_IDS) {
    const card = CARD_BASE[id];
    const live = opts.liveByEndpoint[id] ?? null;
    if (card.source === 'card') {
      lines.push({
        endpoint: id,
        level: 'INFO',
        note: 'live API cannot express this card (tiers, size or promo); charge path ignores live',
      });
      continue;
    }
    if (live == null || !(live > 0)) {
      lines.push({ endpoint: id, level: 'HIGH', note: 'live price missing' });
      continue;
    }
    const delta = (live - card.base) / card.base;
    if (delta > DRIFT_TOLERANCE) {
      lines.push({ endpoint: id, level: 'HIGH', note: `live ${live} is above card ${card.base}` });
    } else if (delta < -DRIFT_TOLERANCE) {
      lines.push({ endpoint: id, level: 'INFO', note: `live ${live} is below card ${card.base}` });
    } else {
      lines.push({ endpoint: id, level: 'ok', note: 'within 10%' });
    }
  }
  const ends = Date.parse(H3_PROMO_ENDS_AT);
  const days = (ends - opts.nowMs) / 86_400_000;
  if (days <= 3 && days > 0) {
    lines.push({
      endpoint: 'minimax/h3-max',
      level: 'INFO',
      note: `H3 Max text/image promo ends ${H3_PROMO_ENDS_AT}`,
    });
  }
  return lines;
}
