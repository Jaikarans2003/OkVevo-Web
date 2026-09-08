import { env } from '@/config/env';

export function falServerKey(): string {
  return (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim();
}

function falHeaders(key: string): HeadersInit {
  return {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
}

type PricingRow = { unit: string; unitPrice: number };

const CACHE_TTL_MS = 60_000;
const pricingCache = new Map<string, { at: number; row: PricingRow }>();

export async function getEndpointPricing(endpoint: string): Promise<PricingRow | null> {
  const id = endpoint.trim();
  if (!id) return null;
  const now = Date.now();
  const hit = pricingCache.get(id);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.row;

  const key = falServerKey();
  if (!key) return null;
  const url = `https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, { headers: falHeaders(key), cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    const nested =
      body.data && typeof body.data === 'object'
        ? (body.data as Record<string, unknown>)
        : body.pricing && typeof body.pricing === 'object'
          ? (body.pricing as Record<string, unknown>)
          : body;
    const unit = String(nested.unit ?? body.unit ?? '').trim();
    const unitPrice = Number(nested.unit_price ?? body.unit_price);
    if (!unit || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
    const row = { unit, unitPrice };
    pricingCache.set(id, { at: now, row });
    return row;
  } catch {
    return null;
  }
}

/** POST /models/pricing/estimate unit_price. Null if the call fails. */
export async function estimateUnitPriceCost(
  endpoint: string,
  unitQuantity: number
): Promise<number | null> {
  const key = falServerKey();
  if (!key) return null;
  try {
    const res = await fetch('https://api.fal.ai/v1/models/pricing/estimate', {
      method: 'POST',
      headers: falHeaders(key),
      cache: 'no-store',
      body: JSON.stringify({
        estimate_type: 'unit_price',
        endpoints: { [endpoint]: { unit_quantity: unitQuantity } },
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { total_cost?: unknown };
    const n = Number(body.total_cost);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export async function submitFalQueue(
  endpoint: string,
  args: Record<string, unknown>
): Promise<{
  request_id: string;
  response_url: string;
  status_url: string;
  cancel_url: string;
}> {
  const key = falServerKey();
  if (!key) throw new Error('FAL_KEY missing');
  const webhook = `${env.siteUrl}/api/webhooks/fal`;
  const url = `https://queue.fal.run/${endpoint}?fal_webhook=${encodeURIComponent(webhook)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: falHeaders(key),
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`fal submit ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = JSON.parse(text) as {
    request_id?: unknown;
    response_url?: unknown;
    status_url?: unknown;
    cancel_url?: unknown;
  };
  if (typeof data.request_id !== 'string' || !data.request_id) {
    throw new Error('fal submit missing request_id');
  }
  return {
    request_id: data.request_id,
    response_url: typeof data.response_url === 'string' ? data.response_url : '',
    status_url: typeof data.status_url === 'string' ? data.status_url : '',
    cancel_url: typeof data.cancel_url === 'string' ? data.cancel_url : '',
  };
}

export async function falQueueGet(url: string): Promise<{ status: number; json: unknown }> {
  const key = falServerKey();
  if (!key) throw new Error('FAL_KEY missing');
  const res = await fetch(url, { headers: falHeaders(key), cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export async function falQueueCancel(url: string): Promise<number> {
  const key = falServerKey();
  if (!key) throw new Error('FAL_KEY missing');
  const res = await fetch(url, { method: 'PUT', headers: falHeaders(key) });
  return res.status;
}
