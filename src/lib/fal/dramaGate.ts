/**
 * Portal drama ledger. Prices come from the chooser. No live Fal call.
 *
 * Assumptions: concurrent cap 2; choose/quote 60 per minute; upload 20 per minute;
 * upload cap 20MB; hold expiry 6h; 1080p means 1920×1080 in either orientation;
 * generate_audio omitted by the client is sent as true (OpenAPI default).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { creditsFromRawMicro, rawMicroTimesQuantity, usdNumberToDecimal } from '../gateway/pricing';
import {
  billedMegapixels,
  capabilityReason,
  choose,
  highResDurationBlocked,
  quoteCard,
  settleBilledSeconds,
  type DramaCard,
  type Price,
  type Quote,
  type RatePrice,
  type Shot,
} from './dramaChooser';

export const DRAMA_CONCURRENT_CAP = 2;
export const HOLD_MS = 6 * 60 * 60 * 1000;
export const CHOOSE_QUOTE_PER_MINUTE = 60;
export const UPLOAD_PER_MINUTE = 20;
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const USD_FLOOR_MICRO = 100n;

const MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
]);
const PRICE_KEYS = new Set(['credits', 'rawUsd', 'rawMicro', 'unitPrice', 'price', 'costUsd']);

export type LedgerRow = {
  userId: string;
  idempotencyKey: string;
  bodyHash: string;
  estimateCredits: number;
  reservedCredits: number;
  actualCredits: number | null;
  settledCredits: number | null;
  releasedCredits: number | null;
  status: 'reserved' | 'settled' | 'released';
  createdAt: number;
  holdExpiresAt: number;
  modelId: string;
  resolution: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  audioSeconds: number | null;
  rawMicro: string;
  rateText: string;
  unit: string;
  requestId: string | null;
  falStatus: string | null;
  alerts: string[];
  args: Record<string, unknown>;
  submitLock: boolean;
};

type Props = Record<string, { enum?: unknown[] } | undefined>;

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((key) => obj[key] !== undefined && !PRICE_KEYS.has(key)).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function bodyHash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function usdToleranceMicro(falMicro: bigint): bigint {
  const halfPercent = (falMicro * 5n) / 1000n;
  return halfPercent > USD_FLOOR_MICRO ? halfPercent : USD_FLOOR_MICRO;
}

export function reconcilePair(
  ledger: { units: number; rawMicro: bigint },
  fal: { units: number; rawMicro: bigint }
): { unitOk: boolean; usdOk: boolean; driftMicro: string; toleranceMicro: string } {
  const drift = ledger.rawMicro > fal.rawMicro ? ledger.rawMicro - fal.rawMicro : fal.rawMicro - ledger.rawMicro;
  const tolerance = usdToleranceMicro(fal.rawMicro);
  return {
    unitOk: ledger.units === fal.units,
    usdOk: drift <= tolerance,
    driftMicro: drift.toString(),
    toleranceMicro: tolerance.toString(),
  };
}

export function a2vSizeFlag(width: number, height: number): string | null {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  if (shortSide === 1080 && longSide === 1920) return null;
  return `audio-to-video output is ${width}x${height}, not 1080p`;
}

export function classifyFalHttp(http: number, body: string): 'retryable' | 'terminal' | 'unknown' {
  if (http === 429 || http >= 500) return 'retryable';
  if (http === 400 || http === 422 || /content[- ]policy|validation/i.test(body)) return 'terminal';
  if (/failed/i.test(body) && /no output/i.test(body)) return 'terminal';
  return 'unknown';
}

export function reviewHold(
  row: LedgerRow,
  falStatus: string | null,
  now: number
): { release: boolean; alert: boolean } {
  if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') {
    return { release: false, alert: row.status === 'reserved' && now > row.holdExpiresAt };
  }
  return { release: false, alert: row.status === 'reserved' && now > row.holdExpiresAt };
}

function propsOf(card: DramaCard): Props {
  const schema = card.input_schema as { properties?: Props } | undefined;
  return schema?.properties ?? {};
}

function enumNumbers(card: DramaCard): number[] {
  const out: number[] = [];
  for (const item of card.duration?.enum ?? []) {
    const n = typeof item === 'number' ? item : Number(item);
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

export function schemaProblems(
  card: DramaCard,
  args: Record<string, unknown>
): string[] {
  const props = propsOf(card);
  const problems: string[] = [];
  const resolution = typeof args.resolution === 'string' ? args.resolution : null;
  if (props.resolution) {
    if (!resolution) problems.push('resolution is missing');
    else if (props.resolution.enum && !props.resolution.enum.includes(resolution)) {
      problems.push(`resolution ${resolution} is not offered`);
    }
  }
  if (props.duration) {
    const duration = args.duration;
    if (duration == null || duration === 'auto') problems.push('duration must be explicit');
    else {
      const seconds = typeof duration === 'number' ? duration : Number(duration);
      if (!Number.isFinite(seconds)) problems.push('duration is not a number');
      else if (highResDurationBlocked(card.id, resolution, seconds)) problems.push('duration is above 10s at this resolution');
      else {
        const listed = enumNumbers(card);
        if (listed.length > 0 && !listed.includes(seconds)) problems.push('duration is outside the card');
        if (typeof card.duration?.min === 'number' && seconds < card.duration.min) problems.push('duration is outside the card');
        if (typeof card.duration?.max === 'number' && seconds > card.duration.max) problems.push('duration is outside the card');
      }
    }
  }
  if (props.generate_audio && typeof args.generate_audio !== 'boolean') {
    problems.push('generate_audio must be explicit');
  }
  return problems;
}

export function prepareFalArgs(
  card: DramaCard,
  args: Record<string, unknown>,
  quote: Quote
): Record<string, unknown> {
  const props = propsOf(card);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (PRICE_KEYS.has(key)) continue;
    if (props[key] || key === 'prompt') out[key] = value;
  }
  if (props.resolution && out.resolution == null && quote.resolution) out.resolution = quote.resolution;
  if (props.duration && (out.duration == null || out.duration === 'auto') && quote.reservedSeconds != null) {
    const enums = props.duration.enum ?? [];
    const numeric = enums.some((item) => typeof item === 'number');
    out.duration = numeric || enums.length === 0 ? quote.reservedSeconds : String(quote.reservedSeconds);
  }
  if (props.generate_audio && typeof out.generate_audio !== 'boolean') out.generate_audio = true;
  return out;
}

function containsUserUrl(value: unknown): boolean {
  if (typeof value === 'string') return /^https?:\/\//i.test(value.trim());
  if (Array.isArray(value)) return value.some(containsUserUrl);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some(containsUserUrl);
  return false;
}

type Catalog = { cards: DramaCard[]; prices: Record<string, Price> };

function pricesFor(cards: DramaCard[], overrides: { id: string; billing_basis: 'output' | 'input_audio'; rates_by_resolution: Record<string, number> }[]): Record<string, Price> {
  const prices: Record<string, Price> = {};
  for (const card of cards) {
    if (card.billing_unit && card.unit_price != null) prices[card.id] = { unit: card.billing_unit, unitPrice: card.unit_price };
  }
  for (const row of overrides) {
    prices[row.id] = { unit: 'seconds', billingBasis: row.billing_basis, ratesByResolution: row.rates_by_resolution };
  }
  return prices;
}

export function loadCatalog(): Catalog {
  const cards = JSON.parse(readFileSync(new URL('./drama-cards.json', import.meta.url), 'utf8')) as DramaCard[];
  const overrides = JSON.parse(readFileSync(new URL('./pricing-overrides.json', import.meta.url), 'utf8')) as {
    overrides: { id: string; billing_basis: 'output' | 'input_audio'; rates_by_resolution: Record<string, number> }[];
  };
  return { cards, prices: pricesFor(cards, overrides.overrides) };
}

function rateOf(price: Price, resolution: string | null): { rateText: string; unit: string } | null {
  if ('ratesByResolution' in price) {
    if (!resolution || price.ratesByResolution[resolution] == null) return null;
    return { rateText: usdNumberToDecimal(price.ratesByResolution[resolution]), unit: 'seconds' };
  }
  return { rateText: usdNumberToDecimal(price.unitPrice), unit: price.unit };
}

export function settleCredits(actualCredits: number, reservedCredits: number): { settled: number; alert: string | null } {
  if (actualCredits > reservedCredits) {
    return { settled: reservedCredits, alert: 'actual above reserved' };
  }
  return { settled: actualCredits, alert: null };
}

export class DramaLedger {
  rows: LedgerRow[] = [];
  balances = new Map<string, number>();
  uploads = new Map<string, { userId: string; audioSeconds: number | null }>();
  readonly cap: number;
  readonly chooseLimit: number;
  readonly uploadLimit: number;
  private hits = new Map<string, number[]>();
  private tail: Promise<void> = Promise.resolve();

  constructor(opts?: { cap?: number; chooseLimit?: number; uploadLimit?: number }) {
    this.cap = opts?.cap ?? DRAMA_CONCURRENT_CAP;
    this.chooseLimit = opts?.chooseLimit ?? CHOOSE_QUOTE_PER_MINUTE;
    this.uploadLimit = opts?.uploadLimit ?? UPLOAD_PER_MINUTE;
  }

  transact<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.tail.then(() => fn());
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }

  allow(userId: string, bucket: string, now: number, limit: number): boolean {
    const key = `${userId}\0${bucket}`;
    const kept = (this.hits.get(key) ?? []).filter((at) => now - at < 60_000);
    if (kept.length >= limit) {
      this.hits.set(key, kept);
      return false;
    }
    kept.push(now);
    this.hits.set(key, kept);
    return true;
  }
}

function asShot(value: unknown): Shot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const shot = value as Shot;
  if (typeof shot.job !== 'string') return null;
  return shot;
}

function obj(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export type DramaReply = { status: number; body: Record<string, unknown> };

export async function handleDrama(
  command: string,
  userId: string,
  body: Record<string, unknown>,
  ledger: DramaLedger,
  catalog: Catalog = loadCatalog(),
  deps: {
    now?: () => number;
    allowUnshipped?: boolean;
    probe?: (bytes: Uint8Array, mime: string) => { seconds: number };
    falSubmit?: (args: Record<string, unknown>) => Promise<{ requestId: string } | { http: number; body: string; retryAfter?: string }>;
    falStatus?: (requestId: string) => Promise<{ status: string }>;
    falCancel?: (requestId: string) => Promise<{ status: string }>;
  } = {}
): Promise<DramaReply> {
  const now = deps.now?.() ?? Date.now();
  if (command === 'choose' || command === 'quote') {
    const limit = command === 'choose' ? ledger.chooseLimit : ledger.chooseLimit;
    if (!ledger.allow(userId, 'choose-quote', now, limit)) {
      return { status: 429, body: { error: 'rate limit' } };
    }
    const shot = asShot(body.shot);
    if (!shot) return { status: 400, body: { error: 'shot is missing' } };
    if (command === 'choose') {
      const result = choose(catalog.cards, catalog.prices, shot);
      return { status: 200, body: { choice: result.choice, rejections: result.rejections } };
    }
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : shot.modelId;
    const card = catalog.cards.find((item) => item.id === endpoint);
    const price = endpoint ? catalog.prices[endpoint] : undefined;
    if (!card || !price) return { status: 400, body: { error: 'unknown model' } };
    const fit = capabilityReason(card, shot, price);
    if (fit) return { status: 400, body: { error: fit } };
    const quoted = quoteCard(card, price, shot);
    if ('reason' in quoted) return { status: 400, body: { error: quoted.reason } };
    return { status: 200, body: { quote: quoted } };
  }
  if (command === 'upload') return upload(userId, body, ledger, now, deps.probe);
  if (command === 'submit') return submit(userId, body, ledger, catalog, now, deps);
  if (command === 'collect') return collect(userId, body, ledger, deps);
  if (command === 'cancel') return cancel(userId, body, ledger, deps);
  return { status: 404, body: { error: 'unknown command' } };
}

function upload(
  userId: string,
  body: Record<string, unknown>,
  ledger: DramaLedger,
  now: number,
  probe?: (bytes: Uint8Array, mime: string) => { seconds: number }
): DramaReply {
  if (!ledger.allow(userId, 'upload', now, ledger.uploadLimit)) {
    return { status: 429, body: { error: 'rate limit' } };
  }
  if (containsUserUrl(body.url) || containsUserUrl(body)) {
    return { status: 400, body: { error: 'user-supplied URL is rejected' } };
  }
  const mime = typeof body.mime === 'string' ? body.mime : '';
  if (!MIME.has(mime)) return { status: 400, body: { error: 'mime is not allowed' } };
  const bytes = typeof body.bytes === 'number' ? body.bytes : -1;
  if (!Number.isInteger(bytes) || bytes < 0 || bytes > UPLOAD_MAX_BYTES) {
    return { status: 400, body: { error: 'file is over the size cap' } };
  }
  let audioSeconds: number | null = null;
  if (mime.startsWith('audio/')) {
    if (!probe) return { status: 400, body: { error: 'audio needs ffprobe' } };
    audioSeconds = probe(new Uint8Array(), mime).seconds;
    if (!Number.isFinite(audioSeconds) || audioSeconds <= 0) return { status: 400, body: { error: 'audio length is missing' } };
  }
  const uploadId = `upl_${ledger.uploads.size + 1}`;
  ledger.uploads.set(uploadId, { userId, audioSeconds });
  return { status: 200, body: { uploadId, audioSeconds } };
}

async function submit(
  userId: string,
  body: Record<string, unknown>,
  ledger: DramaLedger,
  catalog: Catalog,
  now: number,
  deps: {
    allowUnshipped?: boolean;
    falSubmit?: (args: Record<string, unknown>) => Promise<{ requestId: string } | { http: number; body: string; retryAfter?: string }>;
  }
): Promise<DramaReply> {
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  const shot = asShot(body.shot);
  const args = obj(body.args);
  if (!endpoint || !idempotencyKey || !shot || !args) return { status: 400, body: { error: 'submit needs endpoint, key, shot, and args' } };
  if (containsUserUrl(args)) return { status: 400, body: { error: 'user-supplied URL is rejected' } };
  const card = catalog.cards.find((item) => item.id === endpoint);
  const price = catalog.prices[endpoint];
  if (!card || !price) return { status: 400, body: { error: 'unknown model' } };
  if (!card.shipped && !deps.allowUnshipped) return { status: 400, body: { error: 'model is not shipped' } };
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : '';
  const uploaded = uploadId ? ledger.uploads.get(uploadId) : undefined;
  if (uploadId && (!uploaded || uploaded.userId !== userId)) return { status: 400, body: { error: 'upload is missing' } };
  const pricedShot: Shot = { ...shot, modelId: endpoint };
  if (uploaded?.audioSeconds != null) pricedShot.audioSeconds = uploaded.audioSeconds;
  const fit = capabilityReason(card, pricedShot, price);
  if (fit) return { status: 400, body: { error: fit } };
  const quoted = quoteCard(card, price, pricedShot);
  if ('reason' in quoted) return { status: 400, body: { error: quoted.reason } };
  const approved = body.approvedCredits;
  if (typeof approved === 'number' && quoted.credits > approved) {
    return { status: 409, body: { error: 'reserve is above the approved estimate', credits: quoted.credits } };
  }
  const falArgs = prepareFalArgs(card, args, quoted);
  const problems = schemaProblems(card, falArgs);
  if (problems.length > 0) return { status: 400, body: { error: problems.join('; ') } };
  const rate = rateOf(price, quoted.resolution);
  if (!rate) return { status: 400, body: { error: 'no rate' } };
  const basis = (price as RatePrice).billingBasis;
  const hash = bodyHash({ endpoint, shot, args, uploadId });
  const opened = await ledger.transact(async () => {
    const existing = ledger.rows.find((row) => row.userId === userId && row.idempotencyKey === idempotencyKey);
    if (existing) {
      if (existing.bodyHash !== hash) return { conflict: true as const };
      const callFal = existing.status === 'reserved' && !existing.requestId && !existing.submitLock;
      if (callFal) existing.submitLock = true;
      return { row: existing, created: false as const, callFal };
    }
    const count = ledger.rows.filter((row) => row.userId === userId && row.status === 'reserved').length;
    const balance = ledger.balances.get(userId) ?? 0;
    await Promise.resolve();
    if (count >= ledger.cap) return { cap: true as const };
    if (balance < quoted.credits) return { funds: true as const };
    ledger.balances.set(userId, balance - quoted.credits);
    const row: LedgerRow = {
      userId,
      idempotencyKey,
      bodyHash: hash,
      estimateCredits: quoted.credits,
      reservedCredits: quoted.credits,
      actualCredits: null,
      settledCredits: null,
      releasedCredits: null,
      status: 'reserved',
      createdAt: now,
      holdExpiresAt: now + HOLD_MS,
      modelId: endpoint,
      resolution: quoted.resolution,
      outputWidth: null,
      outputHeight: null,
      audioSeconds: basis === 'input_audio' ? pricedShot.audioSeconds ?? null : null,
      rawMicro: quoted.rawMicro,
      rateText: rate.rateText,
      unit: rate.unit,
      requestId: null,
      falStatus: null,
      alerts: [],
      args: falArgs,
      submitLock: true,
    };
    ledger.rows.push(row);
    return { row, created: true as const, callFal: true };
  });
  if ('conflict' in opened) return { status: 409, body: { error: 'idempotency key was reused with a different body' } };
  if ('cap' in opened) return { status: 409, body: { error: 'concurrent job cap' } };
  if ('funds' in opened) return { status: 402, body: { error: 'insufficient credits' } };
  const row = opened.row;
  if (!opened.callFal) {
    return { status: 200, body: { requestId: row.requestId, replay: true, held: row.status === 'reserved', quote: publicQuote(row) } };
  }
  const falSubmit = deps.falSubmit ?? (async () => { throw new Error('live Fal is disabled until smoke is approved'); });
  try {
    const result = await falSubmit(row.args);
    if ('requestId' in result) {
      row.requestId = result.requestId;
      row.falStatus = 'IN_QUEUE';
      row.submitLock = false;
      return { status: 200, body: { requestId: result.requestId, quote: publicQuote(row) } };
    }
    row.submitLock = false;
    const kind = classifyFalHttp(result.http, result.body);
    if (kind === 'terminal') release(ledger, row, result.body);
    return { status: kind === 'retryable' ? 429 : kind === 'terminal' ? 400 : 502, body: { error: result.body, retryAfter: result.retryAfter ?? null, held: row.status === 'reserved' } };
  } catch (err) {
    row.submitLock = false;
    const message = err instanceof Error ? err.message : 'submit failed';
    return { status: 502, body: { error: message, held: row.status === 'reserved' } };
  }
}

function publicQuote(row: LedgerRow) {
  return { credits: row.reservedCredits, rawMicro: row.rawMicro, resolution: row.resolution, modelId: row.modelId };
}

function release(ledger: DramaLedger, row: LedgerRow, reason: string) {
  if (row.status !== 'reserved') return;
  const back = ledger.balances.get(row.userId) ?? 0;
  ledger.balances.set(row.userId, back + row.reservedCredits);
  row.releasedCredits = row.reservedCredits;
  row.settledCredits = 0;
  row.actualCredits = 0;
  row.status = 'released';
  row.alerts.push(reason);
}

async function collect(
  userId: string,
  body: Record<string, unknown>,
  ledger: DramaLedger,
  deps: { falStatus?: (requestId: string) => Promise<{ status: string }> }
): Promise<DramaReply> {
  const row = findRow(ledger, userId, body);
  if (!row) return { status: 404, body: { error: 'job is missing' } };
  const status = body.falStatus && typeof body.falStatus === 'string'
    ? body.falStatus
    : row.requestId && deps.falStatus
      ? (await deps.falStatus(row.requestId)).status
      : null;
  if (!status) return { status: 502, body: { error: 'fal status is missing', held: true } };
  row.falStatus = status;
  if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
    return { status: 200, body: { held: true, falStatus: status } };
  }
  if (status !== 'COMPLETED') {
    if (status === 'FAILED' || status === 'CANCELLED') release(ledger, row, status);
    return { status: 200, body: { held: row.status === 'reserved', falStatus: status, status: row.status } };
  }
  const video = obj(body.video) ?? {};
  applySettle(ledger, row, video, typeof body.probeSeconds === 'number' ? body.probeSeconds : null);
  return { status: 200, body: { status: row.status, settledCredits: row.settledCredits, alerts: row.alerts, outputWidth: row.outputWidth, outputHeight: row.outputHeight } };
}

function applySettle(ledger: DramaLedger, row: LedgerRow, video: Record<string, unknown>, probeSeconds: number | null) {
  if (row.status !== 'reserved') return;
  const width = typeof video.width === 'number' ? video.width : null;
  const height = typeof video.height === 'number' ? video.height : null;
  row.outputWidth = width;
  row.outputHeight = height;
  if (row.modelId.includes('audio-to-video') && width != null && height != null) {
    const flag = a2vSizeFlag(width, height);
    if (flag) row.alerts.push(flag);
  }
  let units: number | null = null;
  if (row.unit === 'seconds' && row.audioSeconds != null) {
    units = settleBilledSeconds(row.audioSeconds);
    if (probeSeconds != null && settleBilledSeconds(probeSeconds) !== units) {
      row.alerts.push('output duration mismatch');
    }
  } else if (row.unit === 'seconds') {
    const duration = typeof video.duration === 'number' ? video.duration : null;
    if (duration == null) {
      row.alerts.push('duration is missing');
      return;
    }
    units = settleBilledSeconds(duration);
    if (probeSeconds != null && settleBilledSeconds(probeSeconds) !== units) row.alerts.push('output duration mismatch');
  } else if (row.unit === 'megapixels' || row.unit === 'processed megapixels') {
    const frames = typeof video.num_frames === 'number' ? video.num_frames : null;
    if (width == null || height == null || frames == null) {
      row.alerts.push('frames are missing');
      return;
    }
    units = billedMegapixels(width, height, frames);
  }
  if (units == null) {
    row.alerts.push('cannot settle');
    return;
  }
  const actualMicro = rawMicroTimesQuantity(row.rateText, BigInt(units));
  const reservedMicro = BigInt(row.rawMicro);
  if (actualMicro > reservedMicro) row.alerts.push('actual above reserved');
  const settledMicro = actualMicro > reservedMicro ? reservedMicro : actualMicro;
  const charge = settleCredits(creditsFromRawMicro(settledMicro), row.reservedCredits);
  if (charge.alert) row.alerts.push(charge.alert);
  row.actualCredits = creditsFromRawMicro(actualMicro);
  row.settledCredits = charge.settled;
  row.releasedCredits = row.reservedCredits - charge.settled;
  const back = ledger.balances.get(row.userId) ?? 0;
  ledger.balances.set(row.userId, back + row.releasedCredits);
  row.status = 'settled';
}

async function cancel(
  userId: string,
  body: Record<string, unknown>,
  ledger: DramaLedger,
  deps: { falStatus?: (requestId: string) => Promise<{ status: string }>; falCancel?: (requestId: string) => Promise<{ status: string }> }
): Promise<DramaReply> {
  const row = findRow(ledger, userId, body);
  if (!row) return { status: 404, body: { error: 'job is missing' } };
  if (!row.requestId || !deps.falStatus || !deps.falCancel) {
    return { status: 502, body: { error: 'fal status is missing', held: row.status === 'reserved' } };
  }
  const current = await deps.falStatus(row.requestId);
  row.falStatus = current.status;
  if (current.status === 'IN_QUEUE' || current.status === 'IN_PROGRESS') {
    const after = await deps.falCancel(row.requestId);
    row.falStatus = after.status;
    if (after.status === 'IN_QUEUE' || after.status === 'IN_PROGRESS') {
      return { status: 200, body: { held: true, falStatus: after.status } };
    }
  }
  if (row.falStatus === 'CANCELLED' || row.falStatus === 'FAILED') release(ledger, row, row.falStatus);
  return { status: 200, body: { status: row.status, falStatus: row.falStatus, held: row.status === 'reserved' } };
}

function findRow(ledger: DramaLedger, userId: string, body: Record<string, unknown>): LedgerRow | undefined {
  const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  return ledger.rows.find((row) => row.userId === userId && (row.idempotencyKey === key || (requestId && row.requestId === requestId)));
}
