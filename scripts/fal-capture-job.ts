/**
 * Cloud Run Job. Reads FAL_BILLING_KEY from the environment (Secret Manager
 * mount on this job only). App Hosting never sees that secret. Never used
 * for generation. Firestore via ADC on the capture service account.
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { captureCharge, captureLagMs, pickEvent, type BillingEvent } from '../src/lib/fal/capture';
import { captureCreditsOn } from '../src/lib/gateway/captureCredits';
import { sendOpsAlert, type AlertStore } from '../src/lib/ops/alert';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

function alertStore(): AlertStore {
  return {
    async has(key) {
      const snap = await db.doc(`opsAlerts/${key}`).get();
      return snap.exists;
    },
    async set(key, record) {
      await db.doc(`opsAlerts/${key}`).set(record);
    },
  };
}

async function fetchEvents(requestId: string, startIso: string): Promise<{ status: number; events: BillingEvent[] }> {
  const key = process.env.FAL_BILLING_KEY?.trim();
  if (!key) throw new Error('FAL_BILLING_KEY missing');
  const url = new URL('https://api.fal.ai/v1/models/billing-events');
  url.searchParams.set('request_id', requestId);
  url.searchParams.set('start', startIso);
  url.searchParams.set('limit', '20');
  const res = await fetch(url, { headers: { Authorization: `Key ${key}` } });
  if (res.status !== 200) return { status: res.status, events: [] };
  const json = (await res.json()) as { items?: BillingEvent[]; data?: BillingEvent[] };
  return { status: 200, events: json.items ?? json.data ?? [] };
}

async function main() {
  const snap = await db
    .collection('gatewayJobs')
    .where('provider', '==', 'fal')
    .where('status', '==', 'settled')
    .where('captured', '==', false)
    .limit(80)
    .get();
  let captured = 0;
  let pending = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const requestId = String(data.falRequestId || doc.id);
    const created = data.createdAt?.toMillis?.() ?? Date.now() - 86400000;
    const { status, events } = await fetchEvents(requestId, new Date(created - 15 * 60 * 1000).toISOString());
    if (status === 403) {
      console.error(JSON.stringify({ severity: 'HIGH', condition: 'billing-key-403', id: 'capture' }));
      process.exit(2);
    }
    const ev = pickEvent(events, requestId);
    if (!ev || ev.cost_total == null || !(ev.cost_total > 0)) {
      pending += 1;
      continue;
    }
    const reserve = Number(data.estimatedCredits || 0);
    const charge = captureCharge(ev.cost_total, reserve);
    const result = await captureCreditsOn(db, {
      requestId: doc.id,
      falUsd: ev.cost_total,
      falCredits: charge.falCredits,
    });
    if (result.overReserve) {
      await sendOpsAlert(
        {
          severity: 'HIGH',
          condition: 'fal-over-reserve',
          id: doc.id,
          text: `Fal billed more than reserve on ${data.endpoint}; absorbed`,
        },
        { nowMs: Date.now(), store: alertStore() }
      );
    }
    const settledAt = data.settledAt?.toMillis?.() ?? created;
    if (ev.timestamp) {
      const lag = captureLagMs(settledAt, ev.timestamp);
      if (lag != null) await doc.ref.set({ captureLagMs: lag }, { merge: true });
    }
    if (!result.skipped) captured += 1;
  }
  console.log(JSON.stringify({ captured, pending, looked: snap.size }));
}

const invoked = process.argv[1]?.includes('fal-capture-job');
if (invoked) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : 'capture failed');
    process.exit(1);
  });
}
