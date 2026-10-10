/**
 * Ops-alert contract: every alert writes an opsAlerts record and one
 * structured log line (severity, condition, id); HIGH dedupes per
 * (condition, id, UTC day); secret-shaped text throws.
 * Run: npx tsx src/lib/ops/alert.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  alertDocId,
  alertLogLine,
  sendOpsAlert,
  utcDay,
  type AlertRecord,
} from '@/lib/ops/alert';

const nowMs = Date.parse('2026-10-10T12:00:00Z');
const day = utcDay(nowMs);
assert.equal(day, '2026-10-10');
assert.equal(alertDocId('price-drift', 'a/b c', day), `falDrift-price-drift-a_b_c-${day}`);

function memStore() {
  const map = new Map<string, AlertRecord>();
  return {
    map,
    has: (k: string) => map.has(k),
    set: (k: string, r: AlertRecord) => void map.set(k, r),
  };
}

// HIGH sends once per (condition, id, day) with record + log line.
const store = memStore();
const lines: string[] = [];
const log = (l: string) => lines.push(l);
const first = await sendOpsAlert(
  { severity: 'HIGH', condition: 'price-drift', id: 'music', text: 'card below live' },
  { nowMs, store, log }
);
const dup = await sendOpsAlert(
  { severity: 'HIGH', condition: 'price-drift', id: 'music', text: 'card below live' },
  { nowMs, store, log }
);
assert.equal(first, 'sent');
assert.equal(dup, 'deduped');
assert.equal(store.map.size, 1);
assert.equal(lines.length, 1);
const parsed = JSON.parse(lines[0]);
assert.equal(parsed.opsAlert, true);
assert.equal(parsed.severity, 'HIGH');
assert.equal(parsed.condition, 'price-drift');
assert.equal(parsed.id, 'music');
const record = [...store.map.values()][0];
assert.equal(record.severity, 'HIGH');
assert.equal(record.resolved, false);
assert.equal(record.condition, 'price-drift');

// Next UTC day is a new dedupe window.
const nextDay = nowMs + 24 * 60 * 60 * 1000;
const again = await sendOpsAlert(
  { severity: 'HIGH', condition: 'price-drift', id: 'music', text: 'card below live' },
  { nowMs: nextDay, store, log }
);
assert.equal(again, 'sent');
assert.equal(store.map.size, 2);

// INFO is not deduped; each send rewrites the record.
const infoStore = memStore();
for (let i = 0; i < 2; i += 1) {
  const r = await sendOpsAlert(
    { severity: 'INFO', condition: 'heartbeat', id: 'day', text: 'beat' },
    { nowMs, store: infoStore, log }
  );
  assert.equal(r, 'sent');
}

// Different condition or id is not deduped against the HIGH above.
const other = await sendOpsAlert(
  { severity: 'HIGH', condition: 'hold-unknown', id: 'music', text: 'x' },
  { nowMs, store, log }
);
assert.equal(other, 'sent');

// Secret-shaped text throws before any store write or log line.
const before = store.map.size;
await assert.rejects(
  sendOpsAlert(
    { severity: 'HIGH', condition: 'x', id: 'y', text: 'token FAL_KEY=abc123 leaked' },
    { nowMs, store, log }
  ),
  /secret/
);
assert.equal(store.map.size, before);

// alertLogLine is parseable and carries the dashboard fields.
const line = JSON.parse(
  alertLogLine({
    day,
    severity: 'INFO',
    condition: 'c',
    id: 'i',
    text: 't',
    resolved: false,
  })
);
assert.deepEqual(
  Object.keys(line).sort(),
  ['condition', 'day', 'id', 'opsAlert', 'severity', 'text'].sort()
);

console.log('alert.selfcheck: ok');
