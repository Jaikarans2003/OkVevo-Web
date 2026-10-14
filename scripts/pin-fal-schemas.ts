/**
 * Pin Fal's OpenAPI document for every rate-card endpoint into
 * src/lib/fal/schemas/<id with / → __>.json, stamped with its fetch time.
 * The submit guard and the drama adapter build/validate Fal bodies against
 * these copies; the fal-drift cron diffs them against live.
 *
 * Re-pin after a schema-drift alert:
 *   npx tsx scripts/pin-fal-schemas.ts
 *   cp src/lib/fal/schemas/*.json ../hermes-agent/okvevo/fal-schemas/
 * Then run both repos' contract checks and ship through staging.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { RATE_CARD_IDS } from '../src/lib/fal/rateCard.ts';

const dir = path.join(import.meta.dirname, '..', 'src', 'lib', 'fal', 'schemas');
mkdirSync(dir, { recursive: true });

for (const id of RATE_CARD_IDS) {
  // Same URL as falSchemaUrl() in src/lib/fal/falSchema.ts (not imported:
  // that module imports the files this script writes).
  const source = `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${id}`;
  const res = await fetch(source);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const openapi = await res.json();
  const pinned = { endpoint_id: id, source, fetched_at: new Date().toISOString(), openapi };
  writeFileSync(path.join(dir, `${id.replaceAll('/', '__')}.json`), `${JSON.stringify(pinned, null, 2)}\n`);
  console.log(`pinned ${id}`);
}
