/**
 * Model catalog shape, filter, and one-hour cache.
 * Run: npx tsx src/lib/gateway/modelCatalog.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  AUTO_MODELS,
  clearModelCatalogCache,
  loadModelCatalog,
  MIN_CONTEXT_TOKENS,
  MODEL_CATALOG_TTL_MS,
  passesModelFilter,
  toCatalogList,
  type UpstreamModel,
} from './modelCatalog.ts';

const good: UpstreamModel = {
  id: 'anthropic/claude-sonnet',
  name: 'Anthropic: Claude Sonnet',
  created: 1_700_000_000,
  context_length: 200_000,
  pricing: { prompt: '0.000003', completion: '0.000015' },
  supported_parameters: ['temperature', 'tools', 'tool_choice'],
};

assert.equal(passesModelFilter(good), true);
assert.equal(passesModelFilter({ ...good, supported_parameters: ['temperature'] }), false);
assert.equal(passesModelFilter({ ...good, context_length: MIN_CONTEXT_TOKENS - 1 }), false);
assert.equal(passesModelFilter({ ...good, context_length: MIN_CONTEXT_TOKENS }), true);
assert.equal(passesModelFilter({ ...good, pricing: { prompt: '0', completion: '0' } }), false);
assert.equal(passesModelFilter({ ...good, pricing: { prompt: '-1', completion: '-1' } }), false);
assert.equal(passesModelFilter({ ...good, pricing: { prompt: '0', completion: '0.00001' } }), true);
assert.equal(
  passesModelFilter({ ...good, id: 'openrouter/fusion', name: 'OpenRouter: Fusion' }),
  false
);

const list = toCatalogList([
  { ...good, id: 'zeta/last', name: 'OpenRouter: Zeta' },
  { ...good, id: 'alpha/first', name: 'Alpha' },
  { ...good, id: 'no-tools', supported_parameters: [] },
  { ...good, id: 'short', context_length: 8192 },
  { ...good, id: 'free', pricing: { prompt: '0', completion: '0' } },
]);

assert.equal(list.object, 'list');
assert.deepEqual(
  list.data.map((row) => row.id),
  [AUTO_MODELS[0].id, AUTO_MODELS[1].id, 'alpha/first', 'zeta/last']
);
for (const row of list.data) {
  assert.equal(row.object, 'model');
  assert.equal(row.owned_by, 'okvevo');
  assert.equal(typeof row.created, 'number');
  assert.doesNotMatch(`${row.id} ${row.name} ${row.owned_by}`, /openrouter/i);
}
assert.equal(list.data[0]?.name, 'OkVevo Cost Effective');
assert.equal(list.data[1]?.name, 'OkVevo Intelligence');
assert.equal(list.data[3]?.name, 'OkVevo: Zeta');

let fetches = 0;
const fetchImpl: typeof fetch = async () => {
  fetches += 1;
  return new Response(JSON.stringify({ data: [good] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

clearModelCatalogCache();
const first = await loadModelCatalog({ fetchImpl, now: 1_000, headers: {} });
const second = await loadModelCatalog({ fetchImpl, now: 1_000 + MODEL_CATALOG_TTL_MS - 1, headers: {} });
assert.equal(fetches, 1);
assert.equal(second, first);
await loadModelCatalog({ fetchImpl, now: 1_000 + MODEL_CATALOG_TTL_MS, headers: {} });
assert.equal(fetches, 2);
assert.equal(first.data[0]?.id, 'okvevo/auto-cost');
assert.equal(first.data[2]?.id, 'anthropic/claude-sonnet');

const route = readFileSync(
  path.join(import.meta.dirname, '../../app/api/gateway/models/route.ts'),
  'utf8'
);
assert.match(route, /gatewayIdToken/);
assert.match(route, /verifyIdToken/);
assert.match(route, /invalidTokenResponse\(\)/);
assert.doesNotMatch(route, /OpenRouter/);

console.log('modelCatalog.selfcheck: ok');
