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
