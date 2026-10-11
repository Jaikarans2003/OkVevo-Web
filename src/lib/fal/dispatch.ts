/**
 * Firestore side of the per-user queue. Fal HTTP stays in handleQueue.
 * takeNextQueued is the only way a queued hold becomes eligible to submit,
 * and it moves the id in one transaction so two dispatchers cannot both
 * return it.
 */

import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebase-admin';
import { falRunDocId } from '@/lib/gateway/debit';
import { canRetrySubmit, fillSlots, parseQueue, slotsForPlan, type QueueDoc } from '@/lib/fal/falQueue';

function writeQueue(
  tx: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  state: QueueDoc,
  needsSubmit: boolean
) {
  tx.set(
    ref,
    { running: state.running, queued: state.queued, queuedCount: state.queued.length, needsSubmit },
    { merge: true }
  );
}

/** Drop a finished or cancelled hold. Idempotent if the id is already gone. */
export async function freeSlot(uid: string, holdId: string): Promise<void> {
  if (!uid || !holdId) return;
  const ref = db.collection('falQueue').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const state = parseQueue(snap.data());
    writeQueue(
      tx,
      ref,
      {
        running: state.running.filter((id) => id !== holdId),
        queued: state.queued.filter((id) => id !== holdId),
      },
      snap.data()?.needsSubmit === true
    );
  });
}

/**
 * Move the oldest queued hold into running when the live plan has a free
 * slot. Returns null when nothing can start. A hold whose submit already
 * started is left in running and not returned (no second Fal call).
 */
export async function takeNextQueued(uid: string): Promise<{ holdId: string; runId: string } | null> {
  const queueRef = db.collection('falQueue').doc(uid);
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const decision = slotsForPlan(userSnap.data()?.plan, userSnap.data()?.planStatus);
    const queueSnap = await tx.get(queueRef);
    let state = parseQueue(queueSnap.data());
    // Reads finish before writes. A crash after the move and before
    // claimFalSubmit leaves the id in running with status queued. Return
    // that id again. submitStarted means Fal may already have the job:
    // do not return it.
    for (const holdId of state.running) {
      const jobSnap = await tx.get(db.collection('gatewayJobs').doc(holdId));
      const job = jobSnap.data();
      const runId = typeof job?.runId === 'string' ? job.runId : '';
      if (!runId || !canRetrySubmit(String(job?.status ?? ''), false)) continue;
      const idemSnap = await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId)));
      if (!canRetrySubmit(String(job?.status ?? ''), idemSnap.data()?.submitStarted === true)) continue;
      return { holdId, runId };
    }
    if (!decision.admit) {
      if (queueSnap.data()?.needsSubmit === true) writeQueue(tx, queueRef, state, false);
      return null;
    }
    const skipped: string[] = [];
    let claimed: { holdId: string; runId: string } | null = null;
    while (state.queued.length > 0 && state.running.length < decision.slots && !claimed) {
      const holdId = state.queued[0];
      state = { running: state.running, queued: state.queued.slice(1) };
      const jobSnap = await tx.get(db.collection('gatewayJobs').doc(holdId));
      const job = jobSnap.data();
      const runId = typeof job?.runId === 'string' ? job.runId : '';
      if (job?.status !== 'queued' || !runId) {
        skipped.push(holdId);
        continue;
      }
      const idemSnap = await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId)));
      if (idemSnap.data()?.submitStarted === true) {
        state = { running: [...state.running, holdId], queued: state.queued };
        continue;
      }
      state = { running: [...state.running, holdId], queued: state.queued };
      tx.set(
        jobSnap.ref,
        { dispatchedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      claimed = { holdId, runId };
    }
    if (skipped.length || claimed || queueSnap.exists) writeQueue(tx, queueRef, state, claimed !== null);
    return claimed;
  });
}

/** Upgrade / backup path: how many queued jobs the current plan can start. Pure; the cron calls takeNextQueued in a loop. */
export function dispatchCount(state: QueueDoc, slots: number): number {
  return fillSlots(state, slots).dispatch.length;
}
