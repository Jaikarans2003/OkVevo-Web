/**
 * Abandoned-hold sweep for jobs whose money status is `submitted`
 * (Fal accepted, not yet settled). Grok/Veo stays `reserved` and is not swept:
 * there is no existing sweeper, and releasing those holds would touch in-flight
 * video-tool jobs. Never resubmits.
 */

import { applyReconcile, type BucketBalances, type JobRecord } from '@/lib/gateway/reserve';

/** ponytail: 6h wall clock. Upgrade: per-model Fal queue SLA. */
export const SUBMITTED_HOLD_MAX_MS = 6 * 60 * 60 * 1000;

export type SweepAction = 'settle' | 'release' | 'leave' | 'alert';

export function sweepAction(falStatus: string): SweepAction {
  const status = falStatus.trim().toUpperCase();
  if (status === 'COMPLETED') return 'settle';
  if (status === 'FAILED' || status === 'ERROR') return 'release';
  if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') return 'leave';
  return 'alert';
}

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
 * Queue wait is not abandonment. The clock starts at dispatchedAt (when the
 * hold left the queue), falling back to createdAt for jobs that never queued.
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
