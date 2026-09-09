/** Parse Fal GET /v1/models/pricing JSON. Live shape is `{ prices: [{ endpoint_id, unit, unit_price }] }`. */

export type PricingRow = { unit: string; unitPrice: number };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function rowFromUnknown(v: unknown): PricingRow | null {
  const rec = asRecord(v);
  if (!rec) return null;
  const unit = String(rec.unit ?? '').trim();
  const unitPrice = Number(rec.unit_price ?? rec.unitPrice);
  if (!unit || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  return { unit, unitPrice };
}

export function parseEndpointPricing(body: unknown, endpoint: string): PricingRow | null {
  const rec = asRecord(body);
  if (!rec) return null;
  const id = endpoint.trim();
  const prices = rec.prices;
  if (Array.isArray(prices) && prices.length > 0) {
    const match =
      prices.find((p) => asRecord(p)?.endpoint_id === id) ?? prices[0];
    const row = rowFromUnknown(match);
    if (row) return row;
  }
  const nested = asRecord(rec.data) ?? asRecord(rec.pricing) ?? rec;
  return rowFromUnknown(nested);
}
