/**
 * Pure reserve/reconcile math. Firestore wrappers live in debit.ts.
 * No 'reserve' transaction type — billing only sees grant/debit/refund.
 */

export type GatewayProvider = 'openrouter' | 'fal' | 'tavily';

export type JobStatus = 'reserved' | 'settled' | 'released';

export type JobRecord = {
  uid: string;
  provider: GatewayProvider;
  estimatedCredits: number;
  status: JobStatus;
};

export type ReserveOk = { ok: true; balance: number; job: JobRecord };
export type ReserveFail = { ok: false; reason: 'insufficient' | 'duplicate' };

export function applyReserve(
  balance: number,
  existing: JobRecord | undefined,
  estimated: number,
  uid: string,
  provider: GatewayProvider
): ReserveOk | ReserveFail {
  if (existing) return { ok: false, reason: 'duplicate' };
  if (!Number.isInteger(estimated) || estimated < 0) {
    return { ok: false, reason: 'insufficient' };
  }
  if (estimated === 0) {
    return {
      ok: true,
      balance,
      job: { uid, provider, estimatedCredits: 0, status: 'reserved' },
    };
  }
  if (!Number.isInteger(balance) || balance < estimated) {
    return { ok: false, reason: 'insufficient' };
  }
  return {
    ok: true,
    balance: balance - estimated,
    job: { uid, provider, estimatedCredits: estimated, status: 'reserved' },
  };
}

export type ReconcileResult =
  | { ok: true; skipped: true }
  | {
      ok: true;
      skipped: false;
      balance: number;
      debitAmount: number;
      status: 'settled';
    };

export function applyReconcile(
  balance: number,
  job: JobRecord | undefined,
  actual: number
): ReconcileResult {
  if (!job || job.status !== 'reserved') {
    return { ok: true, skipped: true };
  }
  const estimated = job.estimatedCredits;
  const billed = Number.isInteger(actual) && actual > 0 ? actual : 0;
  // extra debit if actual > estimated, clamped so balance never goes negative
  let next = balance + estimated - billed;
  if (next < 0) next = 0;
  return {
    ok: true,
    skipped: false,
    balance: next,
    debitAmount: billed,
    status: 'settled',
  };
}

export type ReleaseResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; balance: number; status: 'released' };

export function applyRelease(
  balance: number,
  job: JobRecord | undefined
): ReleaseResult {
  if (!job || job.status !== 'reserved') {
    return { ok: true, skipped: true };
  }
  return {
    ok: true,
    skipped: false,
    balance: balance + job.estimatedCredits,
    status: 'released',
  };
}
