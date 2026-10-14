/**
 * Firestore side of the per-user queue. Fal HTTP stays in handleQueue.
 * Slot handoff (free + promote the oldest waiter) is one transaction.
 * Status changes go through the job machine; a released job is not promoted.
 */

import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebase-admin';
import {
  canRetrySubmit,
  parseQueue,
  promoteHead,
  releaseAndDispatch,
  requeueAtHead,
  slotsForPlan,
  type QueueDoc,
} from '@/lib/fal/falQueue';
import {
  isTerminalQueueStatus,
  shouldAbandonQueuedBehindDeadSlots,
} from '@/lib/fal/holdSweep';
import {
  canTransition,
  decideDefiniteRejection,
  FAL_NOT_ACCEPTED_MESSAGE,
  PLAN_INACTIVE_MESSAGE,
} from '@/lib/fal/jobMachine';
import {
  falRunDocId,
  jobFromSnap,
  loadSpendRelease,
  readBalances,
  writeSpendRelease,
} from '@/lib/gateway/debit';
import { applyRelease } from '@/lib/gateway/reserve';

export type Promoted = { holdId: string; runId: string };

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

function headReady(data: FirebaseFirestore.DocumentData | undefined, nowMs: number): boolean {
  const at = data?.nextAttemptAtMs;
  return typeof at !== 'number' || at <= nowMs;
}

/**
 * queued → dispatching. Already dispatching and not yet sent is ready.
 * Anything else, including released, is refused.
 */
export async function claimQueuedToDispatching(
  uid: string,
  runId: string,
  holdId: string
): Promise<boolean> {
  const jobRef = db.collection('gatewayJobs').doc(holdId);
  const idemRef = db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId));
  return db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const idemSnap = await tx.get(idemRef);
    const status = jobSnap.data()?.status;
    const submitStarted = idemSnap.data()?.submitStarted === true;
    if (status === 'dispatching' && !submitStarted) return true;
    if (status !== 'queued' || !canTransition('queued', 'dispatching')) return false;
    tx.set(
      jobRef,
      { status: 'dispatching', dispatchedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    tx.set(idemRef, { phase: 'dispatching' }, { merge: true });
    return true;
  });
}

/**
 * Drop a finished id and promote the oldest ready waiter in the same transaction.
 * A waiter whose retry time has not arrived stays at the head and blocks later jobs.
 */
export async function handoffSlot(uid: string, holdId: string): Promise<Promoted | null> {
  const queueRef = db.collection('falQueue').doc(uid);
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const queueSnap = await tx.get(queueRef);
    const decision = slotsForPlan(userSnap.data()?.plan, userSnap.data()?.planStatus);
    const slots = decision.admit ? decision.slots : 0;
    const next = releaseAndDispatch(parseQueue(queueSnap.data()), holdId, slots);
    let state = next.state;
    let promoted: Promoted | null = null;
    if (next.dispatch) {
      const jobSnap = await tx.get(db.collection('gatewayJobs').doc(next.dispatch));
      const data = jobSnap.data();
      const runId = typeof data?.runId === 'string' ? data.runId : '';
      const idemRef = db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId));
      const idemSnap = runId ? await tx.get(idemRef) : null;
      const ready =
        data?.status === 'queued' &&
        !!runId &&
        headReady(data, Date.now()) &&
        idemSnap?.data()?.submitStarted !== true &&
        canTransition('queued', 'dispatching');
      if (!ready) {
        state = {
          running: next.state.running.filter((id) => id !== next.dispatch),
          queued: [next.dispatch!, ...next.state.queued.filter((id) => id !== next.dispatch)],
        };
      } else {
        tx.set(
          jobSnap.ref,
          { status: 'dispatching', dispatchedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        tx.set(idemRef, { phase: 'dispatching' }, { merge: true });
        promoted = { holdId: next.dispatch, runId };
      }
    }
    writeQueue(tx, queueRef, state, state.queued.length > 0 || promoted !== null);
    return promoted;
  });
}

/**
 * Drop terminal ids from `running`. Queued holds older than the abandoned
 * window that were blocked only by those dead slots go to `unknown` (credits
 * held, never submitted). Younger waiters stay queued for promote.
 */
export async function recoverStaleRunningSlots(
  uid: string,
  nowMs: number
): Promise<{ pruned: number; abandoned: string[] }> {
  const queueRef = db.collection('falQueue').doc(uid);
  return db.runTransaction(async (tx) => {
    const queueSnap = await tx.get(queueRef);
    const state = parseQueue(queueSnap.data());
    if (state.running.length === 0 && state.queued.length === 0) {
      return { pruned: 0, abandoned: [] as string[] };
    }
    const runningSnaps = [];
    for (const id of state.running) {
      runningSnaps.push(await tx.get(db.collection('gatewayJobs').doc(id)));
    }
    let liveRunningCount = 0;
    let terminalRunningCount = 0;
    const liveRunning: string[] = [];
    for (let i = 0; i < state.running.length; i++) {
      const status = String(runningSnaps[i].data()?.status ?? '');
      if (isTerminalQueueStatus(status)) {
        terminalRunningCount += 1;
      } else {
        liveRunningCount += 1;
        liveRunning.push(state.running[i]);
      }
    }
    const abandoned: string[] = [];
    const keptQueued: string[] = [];
    for (const id of state.queued) {
      const jobSnap = await tx.get(db.collection('gatewayJobs').doc(id));
      const data = jobSnap.data();
      const status = String(data?.status ?? '');
      const createdAtMs = data?.createdAt?.toMillis?.() ?? nowMs;
      const falRequestId = data?.falRequestId;
      if (
        shouldAbandonQueuedBehindDeadSlots({
          status,
          createdAtMs,
          nowMs,
          falRequestId,
          liveRunningCount,
          terminalRunningCount,
        }) &&
        canTransition('queued', 'unknown')
      ) {
        const runId = typeof data?.runId === 'string' ? data.runId : '';
        tx.set(jobSnap.ref, { status: 'unknown' }, { merge: true });
        if (runId) {
          tx.set(
            db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId)),
            { phase: 'unknown' },
            { merge: true }
          );
        }
        abandoned.push(id);
      } else {
        keptQueued.push(id);
      }
    }
    const pruned = state.running.length - liveRunning.length;
    if (pruned === 0 && abandoned.length === 0) {
      return { pruned: 0, abandoned };
    }
    writeQueue(
      tx,
      queueRef,
      { running: liveRunning, queued: keptQueued },
      keptQueued.length > 0
    );
    return { pruned, abandoned };
  });
}

/** Move the oldest ready waiter into a free slot. Does not pass a job that is waiting to retry. */
export async function takeNextQueued(uid: string): Promise<Promoted | null> {
  const queueRef = db.collection('falQueue').doc(uid);
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const decision = slotsForPlan(userSnap.data()?.plan, userSnap.data()?.planStatus);
    const queueSnap = await tx.get(queueRef);
    const state = parseQueue(queueSnap.data());
    if (!decision.admit) {
      if (queueSnap.data()?.needsSubmit === true) writeQueue(tx, queueRef, state, false);
      return null;
    }
    for (const holdId of state.running) {
      const jobSnap = await tx.get(db.collection('gatewayJobs').doc(holdId));
      const data = jobSnap.data();
      const runId = typeof data?.runId === 'string' ? data.runId : '';
      if (!runId) continue;
      const idemSnap = await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId)));
      const started = idemSnap.data()?.submitStarted === true;
      // Crash between reserve (placed running) and the dispatch claim.
      if (data?.status === 'queued' && !started && canTransition('queued', 'dispatching')) {
        tx.set(
          jobSnap.ref,
          { status: 'dispatching', dispatchedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        tx.set(idemSnap.ref, { phase: 'dispatching' }, { merge: true });
        return { holdId, runId };
      }
      if (!canRetrySubmit(String(data?.status ?? ''), started)) continue;
      return { holdId, runId };
    }
    const headId = state.queued[0];
    if (!headId) {
      if (queueSnap.data()?.needsSubmit === true) writeQueue(tx, queueRef, state, false);
      return null;
    }
    const headSnap = await tx.get(db.collection('gatewayJobs').doc(headId));
    const head = headSnap.data();
    if (!headReady(head, Date.now())) return null;
    const runId = typeof head?.runId === 'string' ? head.runId : '';
    const idemSnap = runId
      ? await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId)))
      : null;
    if (head?.status !== 'queued' || !runId || idemSnap?.data()?.submitStarted === true) {
      writeQueue(
        tx,
        queueRef,
        { running: state.running, queued: state.queued.slice(1) },
        state.queued.length > 1
      );
      return null;
    }
    const moved = promoteHead(state, decision.slots);
    if (!moved.dispatch || !canTransition('queued', 'dispatching')) return null;
    tx.set(
      headSnap.ref,
      { status: 'dispatching', dispatchedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    tx.set(idemSnap!.ref, { phase: 'dispatching' }, { merge: true });
    writeQueue(tx, queueRef, moved.state, true);
    return { holdId: moved.dispatch, runId };
  });
}

export type CancelResult =
  | { kind: 'released'; promoted: Promoted | null }
  | { kind: 'await_request' }
  | { kind: 'cancel_remote'; cancelUrl: string; statusUrl: string }
  | { kind: 'noop' };

/**
 * Cancel semantics (Fal queue):
 * - `queued` (not yet sent to Fal): release immediately with a full refund.
 * - `dispatching` / `submitted`: set `cancelRequested` and PUT Fal's cancel URL.
 *   Fal's cancel HTTP 202 / `{state:"running"}` means "ack received", not "stopped".
 *   Credits release only when a later status poll shows terminal CANCELLED/FAILED
 *   (`cancelAtFal` → settle ok:false). If Fal still completes the job, settling
 *   normally (charge) is correct — cancel is best-effort once dispatched.
 * - Queued waiters behind a cancelled head still get promoted (stop future work).
 */
export async function cancelFalJob(uid: string, holdId: string): Promise<CancelResult> {
  const jobRef = db.collection('gatewayJobs').doc(holdId);
  const userRef = db.collection('users').doc(uid);
  const queueRef = db.collection('falQueue').doc(uid);
  return db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const job = jobFromSnap(jobSnap.data());
    if (!job || job.uid !== uid) return { kind: 'noop' as const };
    const data = jobSnap.data() ?? {};
    if (job.status === 'dispatching' || job.status === 'submitted') {
      const falRequestId = typeof data.falRequestId === 'string' ? data.falRequestId : '';
      const cancelUrl = typeof data.falCancelUrl === 'string' ? data.falCancelUrl : '';
      tx.set(jobRef, { cancelRequested: true }, { merge: true });
      const statusUrl = typeof data.falStatusUrl === 'string' ? data.falStatusUrl : '';
      if (falRequestId && cancelUrl) return { kind: 'cancel_remote' as const, cancelUrl, statusUrl };
      return { kind: 'await_request' as const };
    }
    if (job.status !== 'queued') return { kind: 'noop' as const };
    const userSnap = await tx.get(userRef);
    const queueSnap = await tx.get(queueRef);
    const spend = await loadSpendRelease(tx, data);
    const runId = typeof data.runId === 'string' ? data.runId : '';
    const idemRef = db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId));
    const idemSnap = runId ? await tx.get(idemRef) : null;
    const decision = slotsForPlan(userSnap.data()?.plan, userSnap.data()?.planStatus);
    const next = releaseAndDispatch(parseQueue(queueSnap.data()), holdId, decision.admit ? decision.slots : 0);
    const promotedSnap = next.dispatch
      ? await tx.get(db.collection('gatewayJobs').doc(next.dispatch))
      : null;
    const promotedRunId =
      typeof promotedSnap?.data()?.runId === 'string' ? promotedSnap.data()!.runId : '';
    const promotedIdem = promotedRunId
      ? await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(uid, promotedRunId)))
      : null;
    const result = applyRelease(readBalances(userSnap.data()), job);
    if (result.skipped || !canTransition('queued', 'released')) return { kind: 'noop' as const };
    writeSpendRelease(tx, spend);
    tx.set(
      userRef,
      {
        allocationBalance: result.balances.allocationBalance,
        topUpBalance: result.balances.topUpBalance,
      },
      { merge: true }
    );
    tx.set(jobRef, { status: 'released', releaseReason: 'cancelled' }, { merge: true });
    if (idemSnap) tx.set(idemSnap.ref, { phase: 'released', submitStarted: true }, { merge: true });
    const promoted = commitPromotion(tx, next, promotedSnap, promotedIdem);
    writeQueue(
      tx,
      queueRef,
      promoted.state,
      promoted.state.queued.length > 0 || promoted.promoted !== null
    );
    return { kind: 'released' as const, promoted: promoted.promoted };
  });
}

function commitPromotion(
  tx: FirebaseFirestore.Transaction,
  next: { state: QueueDoc; dispatch: string | null },
  promotedSnap: FirebaseFirestore.DocumentSnapshot | null,
  promotedIdem: FirebaseFirestore.DocumentSnapshot | null
): { state: QueueDoc; promoted: Promoted | null } {
  if (!next.dispatch || !promotedSnap) return { state: next.state, promoted: null };
  const data = promotedSnap.data();
  const runId = typeof data?.runId === 'string' ? data.runId : '';
  const ready =
    data?.status === 'queued' &&
    !!runId &&
    headReady(data, Date.now()) &&
    promotedIdem?.data()?.submitStarted !== true &&
    canTransition('queued', 'dispatching');
  if (!ready) {
    return {
      state: {
        running: next.state.running.filter((id) => id !== next.dispatch),
        queued: [next.dispatch, ...next.state.queued.filter((id) => id !== next.dispatch)],
      },
      promoted: null,
    };
  }
  tx.set(
    promotedSnap.ref,
    { status: 'dispatching', dispatchedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  if (promotedIdem) tx.set(promotedIdem.ref, { phase: 'dispatching' }, { merge: true });
  return { state: next.state, promoted: { holdId: next.dispatch, runId } };
}

export type RejectionResult = {
  action: 'requeue' | 'giveUp' | 'released' | 'lost';
  promoted: Promoted | null;
  message: string;
};

/**
 * Fal answered and did not accept. Requeue at the head and keep the hold,
 * or release in full once the attempt or time cap is hit.
 * A cancel requested while dispatching releases instead of retrying.
 * `rejectMessage` (non-retryable 4xx) releases at once with that message.
 */
export async function applyDefiniteRejection(opts: {
  uid: string;
  runId: string;
  holdId: string;
  nowMs: number;
  retryAfterMs: number | null;
  rand: number;
  rejectMessage?: string;
}): Promise<RejectionResult> {
  const jobRef = db.collection('gatewayJobs').doc(opts.holdId);
  const userRef = db.collection('users').doc(opts.uid);
  const queueRef = db.collection('falQueue').doc(opts.uid);
  const idemRef = db.collection('gatewayIdempotency').doc(falRunDocId(opts.uid, opts.runId));
  return db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const job = jobFromSnap(jobSnap.data());
    if (!job || job.status !== 'dispatching' || !canTransition('dispatching', 'queued')) {
      return { action: 'lost' as const, promoted: null, message: '' };
    }
    const data = jobSnap.data() ?? {};
    const userSnap = await tx.get(userRef);
    const queueSnap = await tx.get(queueRef);
    const spend = await loadSpendRelease(tx, data);
    const idemSnap = await tx.get(idemRef);
    const cancelRequested = data.cancelRequested === true;
    const attemptsSoFar = Number(data.submitAttempts ?? 0);
    const decision = cancelRequested
      ? { action: 'giveUp' as const, attempts: attemptsSoFar, message: 'cancelled' }
      : opts.rejectMessage
        ? { action: 'giveUp' as const, attempts: attemptsSoFar + 1, message: opts.rejectMessage }
        : decideDefiniteRejection({
          attempts: typeof data.submitAttempts === 'number' ? data.submitAttempts : 0,
          firstRejectAtMs: typeof data.firstRejectAtMs === 'number' ? data.firstRejectAtMs : null,
          nowMs: opts.nowMs,
          retryAfterMs: opts.retryAfterMs,
          rand: opts.rand,
        });
    if (decision.action === 'requeue') {
      const state = requeueAtHead(parseQueue(queueSnap.data()), opts.holdId);
      tx.set(
        jobRef,
        {
          status: 'queued',
          submitAttempts: decision.attempts,
          firstRejectAtMs: typeof data.firstRejectAtMs === 'number' ? data.firstRejectAtMs : opts.nowMs,
          nextAttemptAtMs: decision.nextAttemptAtMs,
        },
        { merge: true }
      );
      tx.set(idemSnap.ref, { phase: 'queued', submitStarted: false }, { merge: true });
      writeQueue(tx, queueRef, state, true);
      return { action: 'requeue' as const, promoted: null, message: '' };
    }
    const plan = slotsForPlan(userSnap.data()?.plan, userSnap.data()?.planStatus);
    const next = releaseAndDispatch(
      parseQueue(queueSnap.data()),
      opts.holdId,
      plan.admit ? plan.slots : 0
    );
    const promotedSnap = next.dispatch
      ? await tx.get(db.collection('gatewayJobs').doc(next.dispatch))
      : null;
    const promotedRunId =
      typeof promotedSnap?.data()?.runId === 'string' ? promotedSnap!.data()!.runId : '';
    const promotedIdem = promotedRunId
      ? await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(opts.uid, promotedRunId)))
      : null;
    const released = applyRelease(readBalances(userSnap.data()), job);
    if (released.skipped || !canTransition('dispatching', 'released')) {
      return { action: 'lost' as const, promoted: null, message: '' };
    }
    writeSpendRelease(tx, spend);
    tx.set(
      userRef,
      {
        allocationBalance: released.balances.allocationBalance,
        topUpBalance: released.balances.topUpBalance,
      },
      { merge: true }
    );
    const message = cancelRequested ? 'cancelled' : decision.message || FAL_NOT_ACCEPTED_MESSAGE;
    tx.set(
      jobRef,
      {
        status: 'released',
        releaseReason: cancelRequested ? 'cancelled' : 'fal_not_accepted',
        clientMessage: message,
        submitAttempts: decision.attempts,
      },
      { merge: true }
    );
    tx.set(idemSnap.ref, { phase: 'released', submitStarted: true }, { merge: true });
    const promoted = commitPromotion(tx, next, promotedSnap, promotedIdem);
    writeQueue(
      tx,
      queueRef,
      promoted.state,
      promoted.state.queued.length > 0 || promoted.promoted !== null
    );
    return {
      action: cancelRequested ? ('released' as const) : ('giveUp' as const),
      promoted: promoted.promoted,
      message,
    };
  });
}

/**
 * Outcome unknown after send. Hold stays, no resubmit, and the slot is handed
 * to the next waiter in the same transaction. An operator releases later.
 */
export async function applyAmbiguous(
  uid: string,
  runId: string,
  holdId: string
): Promise<{ ok: boolean; promoted: Promoted | null }> {
  const jobRef = db.collection('gatewayJobs').doc(holdId);
  const idemRef = db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId));
  const userRef = db.collection('users').doc(uid);
  const queueRef = db.collection('falQueue').doc(uid);
  return db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const status = jobSnap.data()?.status;
    if (status !== 'dispatching' || !canTransition('dispatching', 'unknown')) {
      return { ok: false, promoted: null };
    }
    const userSnap = await tx.get(userRef);
    const queueSnap = await tx.get(queueRef);
    const plan = slotsForPlan(userSnap.data()?.plan, userSnap.data()?.planStatus);
    const next = releaseAndDispatch(parseQueue(queueSnap.data()), holdId, plan.admit ? plan.slots : 0);
    const promotedSnap = next.dispatch
      ? await tx.get(db.collection('gatewayJobs').doc(next.dispatch))
      : null;
    const promotedRunId =
      typeof promotedSnap?.data()?.runId === 'string' ? promotedSnap!.data()!.runId : '';
    const promotedIdem = promotedRunId
      ? await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(uid, promotedRunId)))
      : null;
    tx.set(jobRef, { status: 'unknown' }, { merge: true });
    tx.set(idemRef, { phase: 'unknown', submitStarted: true }, { merge: true });
    const promoted = commitPromotion(tx, next, promotedSnap, promotedIdem);
    writeQueue(
      tx,
      queueRef,
      promoted.state,
      promoted.state.queued.length > 0 || promoted.promoted !== null
    );
    return { ok: true, promoted: promoted.promoted };
  });
}

/** Plan no longer active: release every queued hold. In-flight Fal jobs are left alone. */
export async function releaseInactiveQueued(uid: string): Promise<number> {
  const userRef = db.collection('users').doc(uid);
  const queueRef = db.collection('falQueue').doc(uid);
  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const decision = slotsForPlan(userSnap.data()?.plan, userSnap.data()?.planStatus);
    if (decision.admit) return 0;
    const queueSnap = await tx.get(queueRef);
    const state = parseQueue(queueSnap.data());
    const snaps = [];
    for (const id of state.queued) snaps.push(await tx.get(db.collection('gatewayJobs').doc(id)));
    const spends = [];
    for (const snap of snaps) spends.push(await loadSpendRelease(tx, snap.data()));
    const idemSnaps = [];
    for (const snap of snaps) {
      const runId = typeof snap.data()?.runId === 'string' ? snap.data()!.runId : '';
      idemSnaps.push(
        runId ? await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId))) : null
      );
    }
    let balances = readBalances(userSnap.data());
    let released = 0;
    for (let i = 0; i < snaps.length; i++) {
      const snap = snaps[i];
      const job = jobFromSnap(snap.data());
      if (!job || job.status !== 'queued' || !canTransition('queued', 'released')) continue;
      const result = applyRelease(balances, job);
      if (result.skipped) continue;
      balances = result.balances;
      writeSpendRelease(tx, spends[i]);
      tx.set(
        snap.ref,
        {
          status: 'released',
          releaseReason: 'plan_inactive',
          clientMessage: PLAN_INACTIVE_MESSAGE,
        },
        { merge: true }
      );
      const idem = idemSnaps[i];
      if (idem) tx.set(idem.ref, { phase: 'released', submitStarted: true }, { merge: true });
      released += 1;
    }
    if (released > 0) {
      tx.set(
        userRef,
        { allocationBalance: balances.allocationBalance, topUpBalance: balances.topUpBalance },
        { merge: true }
      );
    }
    writeQueue(tx, queueRef, { running: state.running, queued: [] }, false);
    return released;
  });
}
