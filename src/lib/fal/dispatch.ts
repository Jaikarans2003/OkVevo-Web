/**
 * Postgres side of the per-user queue. Fal HTTP stays in handleQueue.
 * Slot handoff (free + promote the oldest waiter) is one transaction.
 * Status changes go through the job machine; a released job is not promoted.
 */

import { withTx, type TxSql } from '@/lib/db/tx';
import {
  lockBillingByUserId,
  lockJob,
  updateBillingByUserId,
  updateJob,
} from '@/lib/db/wallet';
import type { IdemRow } from '@/lib/fal/idempotency';
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
  type VendorErrorCode,
} from '@/lib/fal/jobMachine';
import {
  falRunDocId,
  jobFromSnap,
  loadSpendRelease,
  lockIdemRow,
  lockQueue,
  readBalances,
  updateIdemRow,
  upsertQueue,
  writeSpendRelease,
} from '@/lib/gateway/debit';
import { applyRelease } from '@/lib/gateway/reserve';

export type Promoted = { holdId: string; runId: string };

async function writeQueue(
  tx: TxSql,
  uid: string,
  state: QueueDoc,
  needsSubmit: boolean
): Promise<void> {
  await upsertQueue(tx, uid, {
    running: state.running,
    queued: state.queued,
    queuedCount: state.queued.length,
    needsSubmit,
  });
}

function headReady(data: Record<string, unknown> | undefined, nowMs: number): boolean {
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
  const idemId = falRunDocId(uid, runId);
  return withTx(async (tx) => {
    const job = await lockJob(tx, holdId);
    const idem = await lockIdemRow(tx, idemId);
    const status = job?.status;
    const submitStarted = idem?.submitStarted === true;
    if (status === 'dispatching' && !submitStarted) return true;
    if (status !== 'queued' || !canTransition('queued', 'dispatching')) return false;
    await updateJob(tx, holdId, { status: 'dispatching', dispatchedAt: new Date() });
    await updateIdemRow(tx, idemId, { phase: 'dispatching' });
    return true;
  });
}

/** Both sides of a promote: decide readiness from the dispatch target's row, then commit or requeue it. */
async function commitPromotion(
  tx: TxSql,
  uid: string,
  next: { state: QueueDoc; dispatch: string | null },
  promotedRow: Record<string, unknown> | undefined,
  promotedIdem: IdemRow | undefined
): Promise<{ state: QueueDoc; promoted: Promoted | null }> {
  if (!next.dispatch || !promotedRow) return { state: next.state, promoted: null };
  const runId = typeof promotedRow.runId === 'string' ? promotedRow.runId : '';
  const ready =
    promotedRow.status === 'queued' &&
    !!runId &&
    headReady(promotedRow, Date.now()) &&
    promotedIdem?.submitStarted !== true &&
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
  await updateJob(tx, next.dispatch, { status: 'dispatching', dispatchedAt: new Date() });
  await updateIdemRow(tx, falRunDocId(uid, runId), { phase: 'dispatching' });
  return { state: next.state, promoted: { holdId: next.dispatch, runId } };
}

/**
 * Drop a finished id and promote the oldest ready waiter in the same transaction.
 * A waiter whose retry time has not arrived stays at the head and blocks later jobs.
 */
export async function handoffSlot(uid: string, holdId: string): Promise<Promoted | null> {
  return withTx(async (tx) => {
    const billing = await lockBillingByUserId(tx, uid);
    const queue = await lockQueue(tx, uid);
    const decision = slotsForPlan(billing?.plan, billing?.planStatus);
    const slots = decision.admit ? decision.slots : 0;
    const next = releaseAndDispatch(parseQueue(queue), holdId, slots);
    const promotedRow = next.dispatch ? await lockJob(tx, next.dispatch) : undefined;
    const promotedRunId = typeof promotedRow?.runId === 'string' ? promotedRow.runId : '';
    const promotedIdem = promotedRunId
      ? await lockIdemRow(tx, falRunDocId(uid, promotedRunId))
      : undefined;
    const promoted = await commitPromotion(tx, uid, next, promotedRow, promotedIdem);
    await writeQueue(
      tx,
      uid,
      promoted.state,
      promoted.state.queued.length > 0 || promoted.promoted !== null
    );
    return promoted.promoted;
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
  return withTx(async (tx) => {
    const queue = await lockQueue(tx, uid);
    const state = parseQueue(queue);
    if (state.running.length === 0 && state.queued.length === 0) {
      return { pruned: 0, abandoned: [] as string[] };
    }
    const runningRows: (Record<string, unknown> | undefined)[] = [];
    for (const id of state.running) runningRows.push(await lockJob(tx, id));
    let liveRunningCount = 0;
    let terminalRunningCount = 0;
    const liveRunning: string[] = [];
    for (let i = 0; i < state.running.length; i++) {
      const status = String(runningRows[i]?.status ?? '');
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
      const data = await lockJob(tx, id);
      const status = String(data?.status ?? '');
      const createdAtMs = (data?.createdAt as Date | undefined)?.getTime() ?? nowMs;
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
        await updateJob(tx, id, { status: 'unknown' });
        if (runId) await updateIdemRow(tx, falRunDocId(uid, runId), { phase: 'unknown' });
        abandoned.push(id);
      } else {
        keptQueued.push(id);
      }
    }
    const pruned = state.running.length - liveRunning.length;
    if (pruned === 0 && abandoned.length === 0) {
      return { pruned: 0, abandoned };
    }
    await writeQueue(
      tx,
      uid,
      { running: liveRunning, queued: keptQueued },
      keptQueued.length > 0
    );
    return { pruned, abandoned };
  });
}

/** Move the oldest ready waiter into a free slot. Does not pass a job that is waiting to retry. */
export async function takeNextQueued(uid: string): Promise<Promoted | null> {
  return withTx(async (tx) => {
    const billing = await lockBillingByUserId(tx, uid);
    const decision = slotsForPlan(billing?.plan, billing?.planStatus);
    const queue = await lockQueue(tx, uid);
    const state = parseQueue(queue);
    if (!decision.admit) {
      if (queue?.needsSubmit === true) await writeQueue(tx, uid, state, false);
      return null;
    }
    for (const holdId of state.running) {
      const data = await lockJob(tx, holdId);
      const runId = typeof data?.runId === 'string' ? data.runId : '';
      if (!runId) continue;
      const idem = await lockIdemRow(tx, falRunDocId(uid, runId));
      const started = idem?.submitStarted === true;
      // Crash between reserve (placed running) and the dispatch claim.
      if (data?.status === 'queued' && !started && canTransition('queued', 'dispatching')) {
        await updateJob(tx, holdId, { status: 'dispatching', dispatchedAt: new Date() });
        await updateIdemRow(tx, falRunDocId(uid, runId), { phase: 'dispatching' });
        return { holdId, runId };
      }
      if (!canRetrySubmit(String(data?.status ?? ''), started)) continue;
      return { holdId, runId };
    }
    const headId = state.queued[0];
    if (!headId) {
      if (queue?.needsSubmit === true) await writeQueue(tx, uid, state, false);
      return null;
    }
    const head = await lockJob(tx, headId);
    if (!headReady(head, Date.now())) return null;
    const runId = typeof head?.runId === 'string' ? head.runId : '';
    const idemId = runId ? falRunDocId(uid, runId) : null;
    const idem = idemId ? await lockIdemRow(tx, idemId) : undefined;
    if (head?.status !== 'queued' || !runId || idem?.submitStarted === true) {
      await writeQueue(
        tx,
        uid,
        { running: state.running, queued: state.queued.slice(1) },
        state.queued.length > 1
      );
      return null;
    }
    const moved = promoteHead(state, decision.slots);
    if (!moved.dispatch || !canTransition('queued', 'dispatching')) return null;
    await updateJob(tx, headId, { status: 'dispatching', dispatchedAt: new Date() });
    await updateIdemRow(tx, idemId!, { phase: 'dispatching' });
    await writeQueue(tx, uid, moved.state, true);
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
  return withTx(async (tx) => {
    const jobRow = await lockJob(tx, holdId);
    const job = jobFromSnap(jobRow);
    if (!job || job.uid !== uid) return { kind: 'noop' as const };
    const data = jobRow ?? {};
    if (job.status === 'dispatching' || job.status === 'submitted') {
      const falRequestId = typeof data.falRequestId === 'string' ? data.falRequestId : '';
      const cancelUrl = typeof data.falCancelUrl === 'string' ? data.falCancelUrl : '';
      await updateJob(tx, holdId, { cancelRequested: true });
      const statusUrl = typeof data.falStatusUrl === 'string' ? data.falStatusUrl : '';
      if (falRequestId && cancelUrl) return { kind: 'cancel_remote' as const, cancelUrl, statusUrl };
      return { kind: 'await_request' as const };
    }
    if (job.status !== 'queued') return { kind: 'noop' as const };
    const billing = await lockBillingByUserId(tx, uid);
    const queue = await lockQueue(tx, uid);
    const spend = await loadSpendRelease(tx, data);
    const runId = typeof data.runId === 'string' ? data.runId : '';
    const idemId = runId ? falRunDocId(uid, runId) : null;
    const idem = idemId ? await lockIdemRow(tx, idemId) : undefined;
    void idem;
    const decision = slotsForPlan(billing?.plan, billing?.planStatus);
    const next = releaseAndDispatch(parseQueue(queue), holdId, decision.admit ? decision.slots : 0);
    const promotedRow = next.dispatch ? await lockJob(tx, next.dispatch) : undefined;
    const promotedRunId = typeof promotedRow?.runId === 'string' ? promotedRow.runId : '';
    const promotedIdem = promotedRunId
      ? await lockIdemRow(tx, falRunDocId(uid, promotedRunId))
      : undefined;
    const result = applyRelease(readBalances(billing), job);
    if (result.skipped || !canTransition('queued', 'released')) return { kind: 'noop' as const };
    writeSpendRelease(tx, spend);
    await updateBillingByUserId(tx, uid, {
      allocationBalance: result.balances.allocationBalance,
      topUpBalance: result.balances.topUpBalance,
    });
    await updateJob(tx, holdId, { status: 'released', releaseReason: 'cancelled' });
    if (idemId) await updateIdemRow(tx, idemId, { phase: 'released', submitStarted: true });
    const promoted = await commitPromotion(tx, uid, next, promotedRow, promotedIdem);
    await writeQueue(
      tx,
      uid,
      promoted.state,
      promoted.state.queued.length > 0 || promoted.promoted !== null
    );
    return { kind: 'released' as const, promoted: promoted.promoted };
  });
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
  /** Stored on release so the status poll returns the same `error.code`. */
  vendorCode?: VendorErrorCode;
  vendorStatus?: number;
}): Promise<RejectionResult> {
  const idemId = falRunDocId(opts.uid, opts.runId);
  return withTx(async (tx) => {
    const jobRow = await lockJob(tx, opts.holdId);
    const job = jobFromSnap(jobRow);
    if (!job || job.status !== 'dispatching' || !canTransition('dispatching', 'queued')) {
      return { action: 'lost' as const, promoted: null, message: '' };
    }
    const data = jobRow ?? {};
    const billing = await lockBillingByUserId(tx, opts.uid);
    const queue = await lockQueue(tx, opts.uid);
    const spend = await loadSpendRelease(tx, data);
    const idem = await lockIdemRow(tx, idemId);
    void idem;
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
      const state = requeueAtHead(parseQueue(queue), opts.holdId);
      await updateJob(tx, opts.holdId, {
        status: 'queued',
        submitAttempts: decision.attempts,
        firstRejectAtMs: typeof data.firstRejectAtMs === 'number' ? data.firstRejectAtMs : opts.nowMs,
        nextAttemptAtMs: decision.nextAttemptAtMs,
      });
      await updateIdemRow(tx, idemId, { phase: 'queued', submitStarted: false });
      await writeQueue(tx, opts.uid, state, true);
      return { action: 'requeue' as const, promoted: null, message: '' };
    }
    const plan = slotsForPlan(billing?.plan, billing?.planStatus);
    const next = releaseAndDispatch(
      parseQueue(queue),
      opts.holdId,
      plan.admit ? plan.slots : 0
    );
    const promotedRow = next.dispatch ? await lockJob(tx, next.dispatch) : undefined;
    const promotedRunId = typeof promotedRow?.runId === 'string' ? promotedRow.runId : '';
    const promotedIdem = promotedRunId
      ? await lockIdemRow(tx, falRunDocId(opts.uid, promotedRunId))
      : undefined;
    const released = applyRelease(readBalances(billing), job);
    if (released.skipped || !canTransition('dispatching', 'released')) {
      return { action: 'lost' as const, promoted: null, message: '' };
    }
    writeSpendRelease(tx, spend);
    await updateBillingByUserId(tx, opts.uid, {
      allocationBalance: released.balances.allocationBalance,
      topUpBalance: released.balances.topUpBalance,
    });
    const message = cancelRequested ? 'cancelled' : decision.message || FAL_NOT_ACCEPTED_MESSAGE;
    await updateJob(tx, opts.holdId, {
      status: 'released',
      releaseReason: cancelRequested ? 'cancelled' : 'fal_not_accepted',
      clientMessage: message,
      submitAttempts: decision.attempts,
      ...(!cancelRequested && opts.vendorCode
        ? { clientCode: opts.vendorCode, vendorStatus: opts.vendorStatus ?? 0 }
        : {}),
    });
    await updateIdemRow(tx, idemId, { phase: 'released', submitStarted: true });
    const promoted = await commitPromotion(tx, opts.uid, next, promotedRow, promotedIdem);
    await writeQueue(
      tx,
      opts.uid,
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
  const idemId = falRunDocId(uid, runId);
  return withTx(async (tx) => {
    const job = await lockJob(tx, holdId);
    const status = job?.status;
    if (status !== 'dispatching' || !canTransition('dispatching', 'unknown')) {
      return { ok: false, promoted: null };
    }
    const billing = await lockBillingByUserId(tx, uid);
    const queue = await lockQueue(tx, uid);
    const plan = slotsForPlan(billing?.plan, billing?.planStatus);
    const next = releaseAndDispatch(parseQueue(queue), holdId, plan.admit ? plan.slots : 0);
    const promotedRow = next.dispatch ? await lockJob(tx, next.dispatch) : undefined;
    const promotedRunId = typeof promotedRow?.runId === 'string' ? promotedRow.runId : '';
    const promotedIdem = promotedRunId
      ? await lockIdemRow(tx, falRunDocId(uid, promotedRunId))
      : undefined;
    await updateJob(tx, holdId, { status: 'unknown' });
    await updateIdemRow(tx, idemId, { phase: 'unknown', submitStarted: true });
    const promoted = await commitPromotion(tx, uid, next, promotedRow, promotedIdem);
    await writeQueue(
      tx,
      uid,
      promoted.state,
      promoted.state.queued.length > 0 || promoted.promoted !== null
    );
    return { ok: true, promoted: promoted.promoted };
  });
}

/** Plan no longer active: release every queued hold. In-flight Fal jobs are left alone. */
export async function releaseInactiveQueued(uid: string): Promise<number> {
  return withTx(async (tx) => {
    const billing = await lockBillingByUserId(tx, uid);
    const decision = slotsForPlan(billing?.plan, billing?.planStatus);
    if (decision.admit) return 0;
    const queue = await lockQueue(tx, uid);
    const state = parseQueue(queue);
    const rows: (Record<string, unknown> | undefined)[] = [];
    for (const id of state.queued) rows.push(await lockJob(tx, id));
    const spends = [];
    for (const row of rows) spends.push(await loadSpendRelease(tx, row));
    const idemRows: (IdemRow | undefined)[] = [];
    for (const row of rows) {
      const runId = typeof row?.runId === 'string' ? row.runId : '';
      idemRows.push(runId ? await lockIdemRow(tx, falRunDocId(uid, runId)) : undefined);
    }
    void idemRows;
    let balances = readBalances(billing);
    let released = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const job = jobFromSnap(row);
      if (!job || job.status !== 'queued' || !canTransition('queued', 'released')) continue;
      const result = applyRelease(balances, job);
      if (result.skipped) continue;
      balances = result.balances;
      writeSpendRelease(tx, spends[i]);
      await updateJob(tx, state.queued[i], {
        status: 'released',
        releaseReason: 'plan_inactive',
        clientMessage: PLAN_INACTIVE_MESSAGE,
      });
      const runId = typeof row?.runId === 'string' ? row.runId : '';
      if (runId) await updateIdemRow(tx, falRunDocId(uid, runId), { phase: 'released', submitStarted: true });
      released += 1;
    }
    if (released > 0) {
      await updateBillingByUserId(tx, uid, {
        allocationBalance: balances.allocationBalance,
        topUpBalance: balances.topUpBalance,
      });
    }
    await writeQueue(tx, uid, { running: state.running, queued: [] }, false);
    return released;
  });
}
