/**
 * Public model list for the desktop picker.
 * Source: OpenRouter's models API. Server cache is one hour.
 * Filter: tool calling (`supported_parameters` includes `tools`),
 * context_length >= 64_000, and a positive catalog price.
 */

import { env } from '@/config/env';

export const MODEL_CATALOG_TTL_MS = 60 * 60 * 1000;
export const MIN_CONTEXT_TOKENS = 64_000;
const MODELS_URL = 'https://openrouter.ai/api/v1/models';

export const AUTO_MODELS = [
  { id: 'okvevo/auto-cost', name: 'OkVevo Cost Effective' },
  { id: 'okvevo/auto-intelligence', name: 'OkVevo Intelligence' },
] as const;

export type UpstreamModel = {
  id?: unknown;
  name?: unknown;
  created?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
  supported_parameters?: unknown;
};

export type CatalogModel = {
  id: string;
  object: 'model';
  created: number;
  owned_by: 'okvevo';
  name: string;
};

export type CatalogList = { object: 'list'; data: CatalogModel[] };

let cache: { at: number; body: CatalogList } | null = null;

export function clearModelCatalogCache(): void {
  cache = null;
}

function positivePrice(pricing: UpstreamModel['pricing']): boolean {
  if (!pricing) return false;
  const prompt = Number(pricing.prompt);
  const completion = Number(pricing.completion);
  return (
    (Number.isFinite(prompt) && prompt > 0) ||
    (Number.isFinite(completion) && completion > 0)
  );
}

export function passesModelFilter(row: UpstreamModel): boolean {
  if (typeof row.id !== 'string' || !row.id.trim()) return false;
  if (row.id.trim().toLowerCase().startsWith('openrouter/')) return false;
  const params = row.supported_parameters;
  if (!Array.isArray(params) || !params.includes('tools')) return false;
  if (typeof row.context_length !== 'number' || row.context_length < MIN_CONTEXT_TOKENS) {
    return false;
  }
  return positivePrice(row.pricing);
}

/** Display label. Never leaves the word OpenRouter in the picker. */
export function okvevoLabel(name: unknown, id: string): string {
  const raw = typeof name === 'string' && name.trim() ? name.trim() : id;
  return raw.replace(/openrouter/gi, 'OkVevo');
}

export function toCatalogList(rows: UpstreamModel[], createdFallback = 0): CatalogList {
  const kept = rows.filter(passesModelFilter);
  kept.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const data: CatalogModel[] = [
    ...AUTO_MODELS.map((auto) => ({
      id: auto.id,
      object: 'model' as const,
      created: createdFallback,
      owned_by: 'okvevo' as const,
      name: auto.name,
    })),
    ...kept.map((row) => {
      const id = (row.id as string).trim();
      const created = typeof row.created === 'number' && Number.isFinite(row.created) ? row.created : createdFallback;
      return {
        id,
        object: 'model' as const,
        created,
        owned_by: 'okvevo' as const,
        name: okvevoLabel(row.name, id),
      };
    }),
  ];
  return { object: 'list', data };
}

function catalogHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'OkVevo',
    'HTTP-Referer': env.siteUrl,
    'X-Title': 'OkVevo',
  };
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export async function loadModelCatalog(opts?: {
  fetchImpl?: typeof fetch;
  now?: number;
  headers?: HeadersInit;
}): Promise<CatalogList> {
  const now = opts?.now ?? Date.now();
  if (cache && now - cache.at < MODEL_CATALOG_TTL_MS) return cache.body;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const res = await fetchImpl(MODELS_URL, {
    headers: opts?.headers ?? catalogHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    if (cache) return cache.body;
    throw new Error(`model catalog ${res.status}`);
  }
  const body = (await res.json()) as { data?: UpstreamModel[] };
  const list = toCatalogList(Array.isArray(body.data) ? body.data : []);
  cache = { at: now, body: list };
  return list;
}
