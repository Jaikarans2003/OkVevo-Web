/**
 * Public model list for the desktop picker.
 * Source: OpenRouter's models API. Server cache is one hour.
 * Filter: tool calling (`supported_parameters` includes `tools`),
 * context_length >= 64_000, and a positive catalog price.
 */

import { env } from '@/config/env';
import { isRouterAliasModel } from '@/lib/gateway/pricing';

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

export type CustomerJobType = 'Chat' | 'Search' | 'Image' | 'Video' | 'Audio';

export const MEDIA_MODELS: { prefix: string; label: string; jobType: CustomerJobType }[] = [
  { prefix: 'bytedance/seedance-2.0', label: 'Seedance 2.0', jobType: 'Video' },
  { prefix: 'bytedance/seedance-2.5', label: 'Seedance 2.5', jobType: 'Video' },
  { prefix: 'minimax/h3-max', label: 'H3 Max', jobType: 'Video' },
  { prefix: 'alibaba/wan-3.0-prime', label: 'Wan 3.0 Prime', jobType: 'Video' },
  { prefix: 'openai/gpt-image-2', label: 'GPT Image 2', jobType: 'Image' },
  { prefix: 'minimax/music-3', label: 'Music 3', jobType: 'Audio' },
  { prefix: 'fal-ai/minimax/speech-02-hd', label: 'Speech 02 HD', jobType: 'Audio' },
  { prefix: 'fal-ai/minimax/voice-clone', label: 'Voice clone', jobType: 'Audio' },
];

const AUTO_LABEL: Record<string, string> = {
  'okvevo/auto-cost': 'Auto · Cost-effective',
  'okvevo/auto-intelligence': 'Auto · Intelligence',
};

/** Header is kept only for an Auto id when the body model is a router alias. */
export function acceptedRequestedModel(header: string | null | undefined, bodyModel: string): string | null {
  const value = header?.trim() ?? '';
  if (!AUTO_LABEL[value]) return null;
  if (!isRouterAliasModel(bodyModel)) return null;
  return value;
}

function humaniseId(id: string): string {
  const segment = id.split('/').pop() || id;
  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripVendors(label: string): string {
  return label
    .replace(/^[^:]+:\s*/, '')
    .replace(/\bopenrouter\b/gi, '')
    .replace(/\bfal-ai\b/gi, '')
    .replace(/\b(openai|minimax|bytedance|alibaba|tavily)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:])/g, '$1')
    .trim();
}

function mediaMatch(id: string) {
  return MEDIA_MODELS.find((row) => id === row.prefix || id.startsWith(`${row.prefix}/`));
}

/**
 * Customer-facing model name and job type. SQL groups by the raw key;
 * callers map keys through this and then merge labels.
 */
export function customerModel(input: {
  requestedModel?: string | null;
  model?: string | null;
  provider?: string | null;
  catalogName?: (id: string) => string | null;
}): { label: string; jobType: CustomerJobType } {
  const requested = input.requestedModel?.trim() || '';
  const billed = input.model?.trim() || '';
  const key = requested || billed;
  const provider = (input.provider ?? '').trim().toLowerCase();
  const media = mediaMatch(key);

  let label = AUTO_LABEL[key];
  if (!label && (isRouterAliasModel(key) || (!requested && isRouterAliasModel(billed)))) {
    label = 'Auto';
  }
  if (!label && key === 'tavily-search') label = 'Web search';
  if (!label && key === 'tavily-extract') label = 'Web extract';
  if (!label && media) label = media.label;
  if (!label && key) {
    const fromCatalog = input.catalogName?.(key) ?? input.catalogName?.(billed);
    label = fromCatalog ? stripVendors(fromCatalog) : humaniseId(key);
  }
  if (!label) label = 'Unknown';
  label = stripVendors(label) || 'Unknown';

  let jobType: CustomerJobType = 'Chat';
  if (provider === 'tavily' || key.startsWith('tavily-')) jobType = 'Search';
  else if (media) jobType = media.jobType;
  else if (provider === 'fal') jobType = 'Video';
  return { label, jobType };
}
