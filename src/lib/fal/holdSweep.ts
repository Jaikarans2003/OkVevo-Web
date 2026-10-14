/**
 * Abandoned-hold sweep for jobs whose money status is `submitted`
 * (Fal accepted, not yet settled). Grok/Veo stays `reserved` and is not swept:
 * there is no existing sweeper, and releasing those holds would touch in-flight
 * video-tool jobs. Never resubmits.
 */

import { applyReconcile, type BucketBalances, type JobRecord } from '@/lib/gateway/reserve';

/** ponytail: 6h wall clock. Upgrade: per-model Fal queue SLA. */
export const SUBMITTED_HOLD_MAX_MS = 6 * 60 * 60 * 1000;

export function holdIsDue(createdAtMs: number, nowMs: number): boolean {
  return nowMs - createdAtMs >= SUBMITTED_HOLD_MAX_MS;
}

/**
 * Assumption: a `reserved` hold (submit never confirmed, no Fal request id)
 * is abandoned after 30 minutes — the submit path takes seconds. Alert only;
 * a human releases via scripts/drama-release-hold.ts after checking
 * billing-events. Never auto-release, never resubmit.
 */
export const RESERVED_ABANDONED_AFTER_MS = 30 * 60 * 1000;

export function reservedHoldAbandoned(
  createdAtMs: number,
  nowMs: number,
  falRequestId: unknown
): boolean {
  if (typeof falRequestId === 'string' && falRequestId) return false;
  return nowMs - createdAtMs >= RESERVED_ABANDONED_AFTER_MS;
}

/**
 * Queue wait behind live Fal work is not abandonment. The clock starts at
 * dispatchedAt (when the hold left the queue), falling back to createdAt for
 * jobs that never queued.
 */
export function holdCountsAsAbandoned(opts: {
  status: string;
  createdAtMs: number;
  nowMs: number;
  dispatchedAtMs?: number | null;
  falRequestId?: unknown;
}): boolean {
  if (opts.status === 'queued') return false;
  const start =
    typeof opts.dispatchedAtMs === 'number' && opts.dispatchedAtMs > 0
      ? opts.dispatchedAtMs
      : opts.createdAtMs;
  if (opts.status === 'reserved' || opts.status === 'dispatching') {
    return reservedHoldAbandoned(start, opts.nowMs, opts.falRequestId);
  }
  if (opts.status === 'submitted') return holdIsDue(start, opts.nowMs);
  return false;
}

/** Terminal queue occupants that should not hold a slot. */
export function isTerminalQueueStatus(status: string): boolean {
  return status === 'settled' || status === 'released' || status === 'unknown';
}

/**
 * A queued hold stuck behind only terminal `running` ids (finishSlot missed)
 * past the reserved abandoned window — credits held, never submitted. Move to
 * `unknown` so the operator can release; do not auto-submit (client likely gone).
 */
export function shouldAbandonQueuedBehindDeadSlots(opts: {
  status: string;
  createdAtMs: number;
  nowMs: number;
  falRequestId?: unknown;
  liveRunningCount: number;
  terminalRunningCount: number;
}): boolean {
  if (opts.status !== 'queued') return false;
  if (typeof opts.falRequestId === 'string' && opts.falRequestId) return false;
  if (opts.liveRunningCount > 0) return false;
  if (opts.terminalRunningCount === 0) return false;
  return opts.nowMs - opts.createdAtMs >= RESERVED_ABANDONED_AFTER_MS;
}

export type SweepJob = {
  balances: BucketBalances;
  job: JobRecord;
  settled: boolean;
};

/** Same compare-and-set as collect: applyReconcile skips once status is settled. */
export function settleOnce(state: SweepJob, actualCredits: number): boolean {
  if (state.settled) return false;
  const result = applyReconcile(state.balances, state.job, actualCredits);
  if (result.skipped || !result.ok) return false;
  state.balances = result.balances;
  state.job = { ...state.job, status: 'settled' };
  state.settled = true;
  return true;
}
