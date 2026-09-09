/**
 * Fal GET /models/pricing body — live curl 2026-09-08.
 * Run: npx tsx src/lib/fal/pricingParse.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { parseEndpointPricing } from './pricingParse.ts';

const live = {
  prices: [
    {
      endpoint_id: 'fal-ai/flux-2/klein/9b',
      unit_price: 0.006,
      unit: 'megapixels',
      currency: 'USD',
    },
  ],
  next_cursor: null,
  has_more: false,
};

const klein = parseEndpointPricing(live, 'fal-ai/flux-2/klein/9b');
assert.deepEqual(klein, { unit: 'megapixels', unitPrice: 0.006 });

assert.equal(parseEndpointPricing({ unit: 'images', unit_price: 0.15 }, 'x')?.unitPrice, 0.15);
assert.equal(parseEndpointPricing({ prices: [] }, 'fal-ai/flux-2/klein/9b'), null);
assert.equal(parseEndpointPricing({}, 'fal-ai/flux-2/klein/9b'), null);

console.log('pricingParse.selfcheck: ok');
