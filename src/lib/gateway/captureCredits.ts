/**
 * Capture wallet write. Takes a Firestore handle so the Cloud Run job can
 * call the same transaction as App Hosting (re-read the job inside the tx).
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { applyCapture, omitUndefined, type JobRecord } from '@/lib/gateway/reserve';

function readInt(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

function jobFromSnap(data: FirebaseFirestore.DocumentData | undefined): JobRecord | undefined {
  if (!data || data.status !== 'settled' || data.provider !== 'fal') return undefined;
  const uid = data.uid;
  const estimated = data.estimatedCredits;
  if (typeof uid !== 'string' || !uid) return undefined;
  if (typeof estimated !== 'number' || !Number.isInteger(estimated) || estimated < 0) {
    return undefined;
  }
  const heldAllocation = readInt(data.heldAllocation);
  const heldTopUp = readInt(data.heldTopUp);
  const hasSplit = data.heldAllocation !== undefined || data.heldTopUp !== undefined;
  return {
    uid,
    provider: 'fal',
    estimatedCredits: estimated,
    status: 'settled',
    heldAllocation: hasSplit ? heldAllocation : estimated,
    heldTopUp: hasSplit ? heldTopUp : 0,
    settledCredits: typeof data.settledCredits === 'number' ? data.settledCredits : undefined,
    captured: data.captured === true,
  };
}

export async function captureCreditsOn(
  db: Firestore,
  opts: { requestId: string; falUsd: number; falCredits: number }
): Promise<{ skipped: boolean; refund: number; overReserve: boolean }> {
  const { requestId, falUsd, falCredits } = opts;
  if (!requestId) return { skipped: true, refund: 0, overReserve: false };

  const jobRef = db.collection('gatewayJobs').doc(requestId);
  const txnRef = db.collection('creditTransactions').doc(`${requestId}:capture`);
  let out = { skipped: true, refund: 0, overReserve: false };

  await db.runTransaction(async (tx) => {
    const txnSnap = await tx.get(txnRef);
    if (txnSnap.exists) {
      out = { skipped: true, refund: 0, overReserve: false };
      return;
    }
    const jobSnap = await tx.get(jobRef);
    const job = jobFromSnap(jobSnap.data());
    if (!job) return;
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
    if (result.skipped) {
      out = { skipped: true, refund: 0, overReserve: false };
      return;
    }
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
    tx.set(
      txnRef,
      omitUndefined({
        uid: job.uid,
        type: 'refund',
        amount: result.refund,
        provider: 'fal',
        requestId,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
    out = { skipped: false, refund: result.refund, overReserve: result.overReserve };
  });
  return out;
}
