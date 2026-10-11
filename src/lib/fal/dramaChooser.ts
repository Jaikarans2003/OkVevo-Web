/**
 * Pure chooser. Cards and prices are arguments. No network.
 * Drama credits come from creditsFromRawMicro once (integer micro-USD).
 */
import {
  creditsFromRawMicro,
  rawMicroTimesQuantity,
  rawMicroTokens,
  usdNumberToDecimal,
} from '../gateway/pricing';

export type Tier = 'draft' | 'standard' | 'best';

export type DramaCard = {
  id: string;
  max_images: number;
  max_videos: number;
  max_audio: number;
  duration: { enum?: unknown[]; min?: number; max?: number } | null;
  aspects: string[] | null;
  jobs: string[];
  tier: Tier;
  billing_unit: string | null;
  unit_price: number | null;
  shipped: boolean;
  input_schema?: {
    properties?: { resolution?: { enum?: string[] } };
  };
};

export type RatePrice = {
  unit: 'seconds';
  billingBasis: 'output' | 'input_audio';
  ratesByResolution: Record<string, number>;
};

export type UnitPrice = { unit: string; unitPrice: number };
export type Price = RatePrice | UnitPrice;

export type Shot = {
  job: string;
  images: number;
  videos: number;
  audios: number;
  durationSeconds?: number;
  audioSeconds?: number;
  aspect?: string;
  resolution?: string;
  width?: number;
  height?: number;
  frames?: number;
  tier?: Tier;
  spendCapCredits?: number;
  modelId?: string;
};

export type Quote = {
  id: string;
  tier: Tier;
  resolution: string | null;
  reservedSeconds: number | null;
  rawMicro: string;
  rawUsd: number;
  credits: number;
  notice: string | null;
};

export type ChooseResult = {
  choice: Quote | null;
  rejections: { id: string; reason: string }[];
};

const TIER_UP: Record<Tier, Tier | null> = {
  draft: 'standard',
  standard: 'best',
  best: null,
};

export function reserveSeconds(value: number): number {
  return Math.ceil(value);
}

/** Fast LTX 2.5 at 1440p/2160p: 10s cap until Fal confirms the field description. */
export function highResDurationBlocked(
  id: string,
  resolution: string | null,
  seconds: number
): boolean {
  if (!id.startsWith('lightricks/ltx-2.5/') || !id.endsWith('/fast')) return false;
  if (resolution !== '1440p' && resolution !== '2160p') return false;
  return seconds > 10;
}

/** ceil(width × height × frames / 1e6). Fal model pages, 10 Oct 2026. */
export function billedMegapixels(width: number, height: number, frames: number): number {
  const px = BigInt(width) * BigInt(height) * BigInt(frames);
  return Number((px + 999_999n) / 1_000_000n);
}

/**
 * Settle seconds. Smoke compares this to Fal usage quantity.
 * Today it matches reserveSeconds (ceil). Change only this function if Fal bills a fraction.
 */
export function settleBilledSeconds(measuredSeconds: number): number {
  return Math.ceil(measuredSeconds);
}

function resolutionEnum(card: DramaCard): string[] | null {
  const values = card.input_schema?.properties?.resolution?.enum;
  return values && values.length > 0 ? values : null;
}

function enumSeconds(card: DramaCard): number[] {
  const out: number[] = [];
  for (const item of card.duration?.enum ?? []) {
    const n = typeof item === 'number' ? item : Number(item);
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

function fitsDuration(card: DramaCard, seconds: number): boolean {
  const listed = enumSeconds(card);
  if (listed.length > 0) return listed.includes(seconds);
  const min = card.duration?.min;
  const max = card.duration?.max;
  if (typeof min === 'number' && seconds < min) return false;
  if (typeof max === 'number' && seconds > max) return false;
  return true;
}

function worstDuration(card: DramaCard, shot: Shot, basis: 'output' | 'input_audio'): number | null {
  if (basis === 'input_audio') {
    if (shot.audioSeconds == null) return null;
    return reserveSeconds(shot.audioSeconds);
  }
  if (shot.durationSeconds != null) return reserveSeconds(shot.durationSeconds);
  const listed = enumSeconds(card);
  if (listed.length > 0) return Math.max(...listed);
  if (typeof card.duration?.max === 'number') return card.duration.max;
  return null;
}

export function rateMissingFromEnum(card: DramaCard, price: Price): string | null {
  if (!('ratesByResolution' in price)) return null;
  const schema = resolutionEnum(card);
  if (!schema) return null;
  for (const key of Object.keys(price.ratesByResolution)) {
    if (!schema.includes(key)) return key;
  }
  return null;
}

export function allowedResolutions(card: DramaCard, price: Price): string[] | null {
  if (!('ratesByResolution' in price)) return resolutionEnum(card);
  const schema = resolutionEnum(card);
  const priced = Object.keys(price.ratesByResolution);
  const names = schema ? priced.filter((name) => schema.includes(name)) : priced;
  return names.sort();
}

export function resolutionFor(
  card: DramaCard,
  price: Price,
  requested?: string
): { resolution: string | null; reason?: string } {
  const allowed = allowedResolutions(card, price);
  if (!('ratesByResolution' in price)) {
    if (requested && allowed && !allowed.includes(requested)) {
      return { resolution: null, reason: `resolution ${requested} is not offered` };
    }
    return { resolution: requested ?? null };
  }
  if (requested) {
    if (!price.ratesByResolution[requested] || (allowed && !allowed.includes(requested))) {
      return { resolution: null, reason: `resolution ${requested} is not offered` };
    }
    return { resolution: requested };
  }
  const names = allowed ?? [];
  if (names.length === 0) return { resolution: null, reason: 'no priced resolution' };
  let best = names[0];
  for (const name of names) {
    if (price.ratesByResolution[name] < price.ratesByResolution[best]) best = name;
  }
  return { resolution: best };
}

function rawMicroFor(
  card: DramaCard,
  price: Price,
  shot: Shot,
  seconds: number | null,
  resolution: string | null
): bigint | null {
  if ('ratesByResolution' in price) {
    if (resolution == null || seconds == null) return null;
    const rate = price.ratesByResolution[resolution];
    if (rate == null) return null;
    return rawMicroTimesQuantity(usdNumberToDecimal(rate), BigInt(seconds));
  }
  const rateText = usdNumberToDecimal(price.unitPrice);
  const unit = price.unit;
  if (unit === 'seconds') {
    if (seconds == null) return null;
    return rawMicroTimesQuantity(rateText, BigInt(seconds));
  }
  if (unit === 'megapixels' || unit === 'processed megapixels') {
    if (shot.width == null || shot.height == null || shot.frames == null) return null;
    return rawMicroTimesQuantity(rateText, BigInt(billedMegapixels(shot.width, shot.height, shot.frames)));
  }
  if (unit === 'images') {
    return rawMicroTimesQuantity(rateText, BigInt(Math.max(shot.images, 1)));
  }
  if (unit === '1000 tokens') {
    if (shot.width == null || shot.height == null || seconds == null) return null;
    return rawMicroTokens(rateText, shot.width, shot.height, seconds);
  }
  void card;
  return null;
}

export function quoteCard(card: DramaCard, price: Price, shot: Shot): Quote | { reason: string } {
  const basis = 'ratesByResolution' in price ? price.billingBasis : 'output';
  const frameBill =
    !('ratesByResolution' in price) &&
    (price.unit === 'megapixels' || price.unit === 'processed megapixels') &&
    shot.frames != null;
  const seconds = worstDuration(card, shot, basis);
  if (seconds == null && !frameBill) {
    return { reason: basis === 'input_audio' ? 'audio length is missing' : 'duration is missing' };
  }
  if (seconds != null && basis === 'output' && !fitsDuration(card, seconds)) {
    return { reason: 'duration is outside the card' };
  }
  const picked = resolutionFor(card, price, shot.resolution);
  if (picked.reason) return { reason: picked.reason };
  if (seconds != null && highResDurationBlocked(card.id, picked.resolution, seconds)) {
    return { reason: 'duration is above 10s at this resolution' };
  }
  const rawMicro = rawMicroFor(card, price, shot, seconds, picked.resolution);
  if (rawMicro == null) return { reason: 'price needs width, height, and frames' };
  const showedDefault = !shot.resolution && picked.resolution != null && 'ratesByResolution' in price;
  return {
    id: card.id,
    tier: card.tier,
    resolution: picked.resolution,
    reservedSeconds: seconds,
    rawMicro: rawMicro.toString(),
    rawUsd: Number(rawMicro) / 1_000_000,
    credits: creditsFromRawMicro(rawMicro),
    notice: showedDefault ? `using ${picked.resolution}` : null,
  };
}

export function capabilityReason(card: DramaCard, shot: Shot, price: Price | undefined): string | null {
  if (!card.jobs.includes(shot.job)) return `job ${shot.job} is not on this card`;
  if (shot.images > card.max_images) return 'too many stills';
  if (shot.videos > card.max_videos) return 'too many videos';
  if (shot.audios > card.max_audio) return 'too many audio files';
  if (shot.aspect && card.aspects && !card.aspects.includes(shot.aspect)) return 'aspect is not offered';
  if (!price) return 'no injected price';
  return null;
}

function consider(
  cards: DramaCard[],
  prices: Record<string, Price>,
  shot: Shot,
  tier: Tier | null
): { quote: Quote | null; rejections: { id: string; reason: string }[]; capBlocked: boolean } {
  const rejections: { id: string; reason: string }[] = [];
  const quotes: Quote[] = [];
  let capBlocked = false;
  const pool = cards.filter((card) => (tier == null ? true : card.tier === tier));
  for (const card of pool) {
    const fit = capabilityReason(card, shot, prices[card.id]);
    if (fit) {
      rejections.push({ id: card.id, reason: fit });
      continue;
    }
    const quoted = quoteCard(card, prices[card.id], shot);
    if ('reason' in quoted) {
      rejections.push({ id: card.id, reason: quoted.reason });
      continue;
    }
    if (shot.spendCapCredits != null && quoted.credits > shot.spendCapCredits) {
      capBlocked = true;
      rejections.push({ id: card.id, reason: `spend cap blocks ${quoted.credits} credits` });
      continue;
    }
    quotes.push(quoted);
  }
  quotes.sort((a, b) => a.credits - b.credits || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { quote: quotes[0] ?? null, rejections, capBlocked };
}

function withNotice(quote: Quote, tierNotice: string | null): Quote {
  const parts = [tierNotice, quote.notice].filter((part): part is string => !!part);
  return { ...quote, notice: parts.length > 0 ? parts.join('; ') : null };
}

export function choose(cards: DramaCard[], prices: Record<string, Price>, shot: Shot): ChooseResult {
  const shipped = cards.filter((card) => card.shipped);
  if (shot.modelId) {
    const named = shipped.filter((card) => card.id === shot.modelId);
    if (named.length === 0) {
      return { choice: null, rejections: [{ id: shot.modelId, reason: 'named model is not shipped' }] };
    }
    const pass = consider(named, prices, shot, null);
    return { choice: pass.quote, rejections: pass.rejections };
  }
  let tier: Tier | null = shot.tier ?? 'standard';
  const rejections: { id: string; reason: string }[] = [];
  let tierNotice: string | null = null;
  while (tier) {
    const pass = consider(shipped, prices, shot, tier);
    rejections.push(...pass.rejections);
    if (pass.quote) return { choice: withNotice(pass.quote, tierNotice), rejections };
    if (pass.capBlocked) return { choice: null, rejections };
    const next = TIER_UP[tier];
    if (!next) break;
    tierNotice = `no ${tier} model fits this shot; using ${next}`;
    tier = next;
  }
  return { choice: null, rejections };
}
