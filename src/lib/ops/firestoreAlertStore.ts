/** Production AlertStore backed by the opsAlerts collection. */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import type { AlertStore } from '@/lib/ops/alert';

export function firestoreAlertStore(db: Firestore): AlertStore {
  return {
    async has(key) {
      return (await db.doc(`opsAlerts/${key}`).get()).exists;
    },
    async set(key, record) {
      await db.doc(`opsAlerts/${key}`).set({ ...record, at: FieldValue.serverTimestamp() });
    },
  };
}
