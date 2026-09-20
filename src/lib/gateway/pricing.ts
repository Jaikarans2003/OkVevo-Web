/**
 * Gateway USD→credits math. Lives here, not in types/credits.ts
 * (that file is the opaque integer ledger and must stay FX-free).
 */

import { env } from '@/config/env';

export const MARGIN = 2.0;
// ponytail: placeholder until Razorpay tiers land (Phase 3.5). Replace then.
export const PLACEHOLDER_CREDITS_PER_USD = 1000;

const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 60_000;

/** OpenRouter router slugs — catalog price is $0; bill the routed model instead. */
export const ROUTER_ALIAS_MODELS = new Set([
  'openrouter/auto',
  'openrouter/auto-beta',
  'openrouter/pareto-code',
]);

/** Ceiling when allow-list rates are unavailable (catalog down / empty plugins). */
export const ROUTER_RESERVE_FALLBACK_MODEL = 'anthropic/claude-opus-5';

export type Rates = { promptPerToken: number; completionPerToken: number };

// ponytail: last-resort if even opus-5 lookup fails. Ceiling, not a price quote.
const HARD_RESERVE_RATES: Rates = {
  promptPerToken: 15e-6,
  completionPerToken: 75e-6,
};

let cache: { at: number; byId: Map<string, Rates> } | null = null;

export function isRouterAliasModel(model: string): boolean {
  return ROUTER_ALIAS_MODELS.has(model.trim());
}

/** Positive per-token rates — catalog 0/0 is not billable. */
export function hasPositiveRates(rates: Rates | null | undefined): rates is Rates {
  return (
    !!rates &&
    Number.isFinite(rates.promptPerToken) &&
    Number.isFinite(rates.completionPerToken) &&
    (rates.promptPerToken > 0 || rates.completionPerToken > 0)
  );
}

/**
 * Concrete model to price a completed turn. Prefer response.model when it is
 * not a router alias; else the request model when that is concrete.
 */
export function settleBillModel(
  requestModel: string,
  responseModel: string | undefined
): string | null {
  const scan = responseModel?.trim() ?? '';
  if (scan && !isRouterAliasModel(scan)) return scan;
  const req = requestModel.trim();
  if (req && !isRouterAliasModel(req)) return req;
  return null;
}

export function creditsFromTokens(opts: {
  promptTokens: number;
  completionTokens: number;
  promptPerToken: number;
  completionPerToken: number;
}): { rawUsd: number; costUsd: number; credits: number } {
  // ponytail: prompt+completion only — cache/reasoning surcharges are a pre-live backlog item.
  const rawUsd =
    opts.promptTokens * opts.promptPerToken +
    opts.completionTokens * opts.completionPerToken;
  return creditsFromUsd(rawUsd);
}

/** Fal / Tavily: ceil(rawUsd × MARGIN × 1000). Chat keeps creditsFromTokens. */
export function creditsFromUsd(rawUsd: number): {
  rawUsd: number;
  costUsd: number;
  credits: number;
} {
  if (!Number.isFinite(rawUsd) || rawUsd <= 0) {
    return { rawUsd: 0, costUsd: 0, credits: 0 };
  }
  const costUsd = rawUsd * MARGIN;
  const credits = Math.ceil(costUsd * PLACEHOLDER_CREDITS_PER_USD);
  return { rawUsd, costUsd, credits };
}

export function clampDebitAmount(computed: number, balanceBefore: number): number {
  if (!Number.isInteger(computed) || computed <= 0) return 0;
  if (!Number.isInteger(balanceBefore) || balanceBefore <= 0) return 0;
  return Math.min(computed, balanceBefore);
}

function parseRates(pricing: unknown): Rates | null {
  if (!pricing || typeof pricing !== 'object') return null;
  const p = pricing as { prompt?: unknown; completion?: unknown };
  const promptPerToken = Number(p.prompt);
  const completionPerToken = Number(p.completion);
  if (!Number.isFinite(promptPerToken) || !Number.isFinite(completionPerToken)) {
    return null;
  }
  return { promptPerToken, completionPerToken };
}

function splitAuthorSlug(model: string): { author: string; slug: string } | null {
  const i = model.indexOf('/');
  if (i <= 0 || i === model.length - 1) return null;
  return { author: model.slice(0, i), slug: model.slice(i + 1) };
}

function orHeaders(): HeadersInit {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  const headers: Record<string, string> = {
    'HTTP-Referer': env.siteUrl,
    'X-Title': 'Nia',
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function fetchOneModel(model: string): Promise<Rates | null> {
  const parts = splitAuthorSlug(model);
  if (!parts) return null;
  const url = `${MODELS_URL}/${encodeURIComponent(parts.author)}/${encodeURIComponent(parts.slug)}`;
  try {
    const res = await fetch(url, { headers: orHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { pricing?: unknown }; pricing?: unknown };
    return parseRates(body.data?.pricing ?? body.pricing);
  } catch {
    return null;
  }
}

async function fetchAllModels(): Promise<Map<string, Rates>> {
  const byId = new Map<string, Rates>();
  try {
    const res = await fetch(MODELS_URL, { headers: orHeaders(), cache: 'no-store' });
    if (!res.ok) return byId;
    const body = (await res.json()) as { data?: Array<{ id?: unknown; pricing?: unknown }> };
    for (const row of body.data ?? []) {
      if (typeof row.id !== 'string') continue;
      const rates = parseRates(row.pricing);
      if (rates) byId.set(row.id, rates);
    }
  } catch {
    return byId;
  }
  return byId;
}

export async function lookupModelRates(model: string): Promise<Rates | null> {
  const id = model.trim();
  if (!id) return null;
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    const hit = cache.byId.get(id);
    if (hit) return hit;
  }

  const one = await fetchOneModel(id);
  if (one) {
    if (!cache || now - cache.at >= CACHE_TTL_MS) {
      cache = { at: now, byId: new Map() };
    }
    cache.byId.set(id, one);
    return one;
  }

  const all = await fetchAllModels();
  cache = { at: Date.now(), byId: all };
  return all.get(id) ?? null;
}

/**
 * Component-wise max prompt/completion rates among models (skip aliases + 0/0).
 * Always returns positive rates — falls back to opus-5, then a hard ceiling.
 */
export async function lookupMaxRatesAmongModels(
  modelIds: string[]
): Promise<Rates> {
  let maxPrompt = 0;
  let maxCompletion = 0;
  for (const raw of modelIds) {
    const id = raw.trim();
    if (!id || isRouterAliasModel(id)) continue;
    const rates = await lookupModelRates(id);
    if (!hasPositiveRates(rates)) continue;
    maxPrompt = Math.max(maxPrompt, rates.promptPerToken);
    maxCompletion = Math.max(maxCompletion, rates.completionPerToken);
  }
  if (maxPrompt > 0 || maxCompletion > 0) {
    return { promptPerToken: maxPrompt, completionPerToken: maxCompletion };
  }
  const fallback = await lookupModelRates(ROUTER_RESERVE_FALLBACK_MODEL);
  if (hasPositiveRates(fallback)) return fallback;
  return HARD_RESERVE_RATES;
}

/**
 * Rates used to reserve a chat hold.
 * Router aliases: never catalog 0/0 — max(allowed_models) or opus-5 ceiling.
 * Normal models: catalog rates as-is (including free 0/0).
 */
export async function resolveChatReserveRates(opts: {
  model: string;
  allowedModels: string[];
}): Promise<Rates | null> {
  const id = opts.model.trim();
  if (!id) return null;
  if (isRouterAliasModel(id)) {
    return lookupMaxRatesAmongModels(opts.allowedModels);
  }
  return lookupModelRates(id);
}
