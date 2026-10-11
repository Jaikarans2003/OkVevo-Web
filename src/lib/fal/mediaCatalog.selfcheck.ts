/**
 * Media catalog selfcheck — the gateway side of the catalog contract.
 * Every shipped catalog id must be meterable on this gateway (fail-closed:
 * handleSubmit 400s anything not in METERABLE_ENDPOINTS before any reserve,
 * so a shipped-but-unmetered id would be a user-facing regression, and a
 * meterable-but-unshipped catalog row is just an inactive row).
 * Run: npx tsx src/lib/fal/mediaCatalog.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { METERABLE_ENDPOINTS } from './allowlist.ts';

interface CatalogRow {
  id: string;
  shipped?: boolean;
  modes?: string[];
  tier?: string;
}

const catalogPath = path.join(import.meta.dirname, 'media-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
  version?: number;
  photos?: CatalogRow[];
  videos?: CatalogRow[];
};

assert.ok((catalog.version ?? 0) >= 1, 'catalog version missing');

const shipped = [...(catalog.photos ?? []), ...(catalog.videos ?? [])].filter(
  (r) => r.shipped
);
assert.ok(shipped.length > 0, 'no shipped rows');

for (const row of shipped) {
  assert.ok(
    METERABLE_ENDPOINTS.has(row.id),
    `shipped catalog id is not meterable on the gateway: ${row.id} — ` +
      'add it to METERABLE_ENDPOINTS (with verified unit pricing) or flip shipped back to false'
  );
}

console.log(
  `mediaCatalog.selfcheck: ok (version=${catalog.version}, ${shipped.length} shipped ids all meterable)`
);
