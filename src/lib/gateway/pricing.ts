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

type Rates = { promptPerToken: number; completionPerToken: number };

let cache: { at: number; byId: Map<string, Rates> } | null = null;

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
