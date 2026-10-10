/**
 * Cloud Run Job. Reads FAL_BILLING_KEY from the environment (Secret Manager
 * mount on this job only). App Hosting never sees that secret. Never used
 * for generation. Firestore via ADC on the capture service account.
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { captureCharge, captureLagMs, pickEvent, type BillingEvent } from '../src/lib/fal/capture';
import { sendOpsAlert, type AlertStore } from '../src/lib/ops/alert';
import { applyCapture, type JobRecord } from '../src/lib/gateway/reserve';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

function jobFromData(data: Record<string, unknown>): JobRecord | null {
  if (data.status !== 'settled' || data.provider !== 'fal') return null;
  return {
    uid: String(data.uid || ''),
    provider: 'fal',
    estimatedCredits: Number(data.estimatedCredits || 0),
    status: 'settled',
    heldAllocation: Number(data.heldAllocation || 0),
    heldTopUp: Number(data.heldTopUp || 0),
    settledCredits: typeof data.settledCredits === 'number' ? data.settledCredits : undefined,
    captured: data.captured === true,
  };
}

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

async function captureOne(docId: string, job: JobRecord, falUsd: number, falCredits: number) {
  const jobRef = db.collection('gatewayJobs').doc(docId);
  const txnRef = db.collection('creditTransactions').doc(`${docId}:capture`);
  let out = { skipped: true, refund: 0, overReserve: false };
  await db.runTransaction(async (tx) => {
    if ((await tx.get(txnRef)).exists) return;
    const userRef = db.collection('users').doc(job.uid);
    const userSnap = await tx.get(userRef);
    const data = userSnap.data() || {};
    const result = applyCapture(
      {
        allocationBalance: Number(data.allocationBalance || 0),
        topUpBalance: Number(data.topUpBalance || 0),
      },
      job,
      falCredits
    );
    if (result.skipped) return;
    tx.set(
      userRef,
      {
        allocationBalance: result.balances.allocationBalance,
        topUpBalance: result.balances.topUpBalance,
      },
      { merge: true }
    );
    tx.set(
      jobRef,
      {
        captured: true,
        capturedAt: FieldValue.serverTimestamp(),
        capturedFalUsd: falUsd,
        settledCredits: result.settledCredits,
        actualCredits: result.settledCredits,
        heldAllocation: result.heldAllocation,
        heldTopUp: result.heldTopUp,
      },
      { merge: true }
    );
    tx.set(txnRef, {
      uid: job.uid,
      type: 'refund',
      amount: result.refund,
      provider: 'fal',
      requestId: docId,
      createdAt: FieldValue.serverTimestamp(),
    });
    out = { skipped: false, refund: result.refund, overReserve: result.overReserve };
  });
  return out;
}

async function main() {
  const snap = await db.collection('gatewayJobs').where('provider', '==', 'fal').where('status', '==', 'settled').limit(80).get();
  let captured = 0;
  let pending = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.captured === true) continue;
    const job = jobFromData(data as Record<string, unknown>);
    if (!job || !job.uid) continue;
    const requestId = String(data.falRequestId || doc.id);
    const created = data.createdAt?.toMillis?.() ?? Date.now() - 86400000;
    const { status, events } = await fetchEvents(requestId, new Date(created - 15 * 60 * 1000).toISOString());
    if (status === 403) {
      console.error(JSON.stringify({ severity: 'HIGH', condition: 'billing-key-403', id: 'capture' }));
      process.exit(2);
    }
    const ev = pickEvent(events, requestId);
    if (!ev || ev.cost_total == null) {
      pending += 1;
      continue;
    }
    const charge = captureCharge(ev.cost_total, job.estimatedCredits);
    const result = await captureOne(doc.id, job, ev.cost_total, charge.falCredits);
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
