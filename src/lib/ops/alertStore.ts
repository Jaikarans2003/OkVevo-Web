/** Production AlertStore backed by the ops_alerts table. */
import type { JSONValue } from 'postgres';

import type { DbHandle } from '@/lib/db/wallet';
import type { AlertStore } from '@/lib/ops/alert';

/**
 * Shallow top-level merge into ops_alerts.data — the jsonb `||` concat
 * operator matches Firestore's `.set(obj, { merge: true })` for these
 * flat-field records (fx-drift / fal-drift write partial payloads and
 * expect the rest of the doc to survive).
 */
export async function setOpsAlert(
  db: DbHandle,
  key: string,
  data: Record<string, unknown>
): Promise<void> {
  await db`
    insert into ops_alerts ${db({ id: key, data: db.json(data as JSONValue) })}
    on conflict (id) do update set data = ops_alerts.data || excluded.data
  `;
}

export async function getOpsAlert(
  db: DbHandle,
  key: string
): Promise<Record<string, unknown> | undefined> {
  const rows = await db`select data from ops_alerts where id = ${key}`;
  return rows[0]?.data as Record<string, unknown> | undefined;
}

export function alertStore(db: DbHandle): AlertStore {
  return {
    async has(key) {
      const rows = await db`select 1 from ops_alerts where id = ${key}`;
      return rows.length > 0;
    },
    async set(key, record) {
      await setOpsAlert(db, key, { ...record, at: new Date().toISOString() });
    },
  };
}
