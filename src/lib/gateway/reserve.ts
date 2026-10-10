/**
 * Pure reserve/reconcile math. Firestore wrappers live in debit.ts.
 * Two-bucket FIFO: spend allocation first, then topUp.
 * No 'reserve' transaction type — billing only sees grant/debit/refund.
 */

export type GatewayProvider = 'openrouter' | 'fal' | 'tavily';

/** submitted = Fal accepted, hold still open. unknown = no Fal id; hold stays. */
export type JobStatus = 'reserved' | 'submitted' | 'unknown' | 'settled' | 'released';

export type BucketBalances = {
  allocationBalance: number;
  topUpBalance: number;
};

export type JobRecord = {
  uid: string;
  provider: GatewayProvider;
  estimatedCredits: number;
  status: JobStatus;
  heldAllocation: number;
  heldTopUp: number;
  /** Credits actually taken at provisional settle. */
  settledCredits?: number;
  /** Capture job has applied Fal billing-events. Idempotency flag. */
  captured?: boolean;
};

export type ReserveOk = {
  ok: true;
  balances: BucketBalances;
  job: JobRecord;
};
export type ReserveFail = { ok: false; reason: 'insufficient' | 'duplicate' };

function splitFifo(need: number, allocation: number, topUp: number): {
  heldAllocation: number;
  heldTopUp: number;
  balances: BucketBalances;
} | null {
  if (!Number.isInteger(need) || need < 0) return null;
  if (!Number.isInteger(allocation) || allocation < 0) return null;
  if (!Number.isInteger(topUp) || topUp < 0) return null;
  if (need === 0) {
    return {
      heldAllocation: 0,
      heldTopUp: 0,
      balances: { allocationBalance: allocation, topUpBalance: topUp },
    };
  }
  if (allocation + topUp < need) return null;
  const heldAllocation = Math.min(need, allocation);
  const heldTopUp = need - heldAllocation;
  return {
    heldAllocation,
    heldTopUp,
    balances: {
      allocationBalance: allocation - heldAllocation,
      topUpBalance: topUp - heldTopUp,
    },
  };
}

export function applyReserve(
  balances: BucketBalances,
  existing: JobRecord | undefined,
  estimated: number,
  uid: string,
  provider: GatewayProvider
): ReserveOk | ReserveFail {
  if (existing) return { ok: false, reason: 'duplicate' };
  const split = splitFifo(estimated, balances.allocationBalance, balances.topUpBalance);
  if (!split) return { ok: false, reason: 'insufficient' };
  return {
    ok: true,
    balances: split.balances,
    job: {
      uid,
      provider,
      estimatedCredits: estimated,
      status: 'reserved',
      heldAllocation: split.heldAllocation,
      heldTopUp: split.heldTopUp,
    },
  };
}

export type ReconcileResult =
  | { ok: true; skipped: true }
  | {
      ok: true;
      skipped: false;
      balances: BucketBalances;
      debitAmount: number;
      status: 'settled';
      heldAllocation: number;
      heldTopUp: number;
    };

/**
 * Return held amounts, then re-hold actual via FIFO from the restored wallets.
 * Clamps so neither bucket goes negative. debitAmount stays the billed amount
 * (same as single-balance reconcile).
 */
export function applyReconcile(
  balances: BucketBalances,
  job: JobRecord | undefined,
  actual: number
): ReconcileResult {
  if (!job || (job.status !== 'reserved' && job.status !== 'submitted')) {
    return { ok: true, skipped: true };
  }
  const billed = Number.isInteger(actual) && actual > 0 ? actual : 0;
  const restoredAlloc = balances.allocationBalance + job.heldAllocation;
  const restoredTop = balances.topUpBalance + job.heldTopUp;
  const available = restoredAlloc + restoredTop;
  const take = Math.min(billed, available);
  const heldAllocation = Math.min(take, restoredAlloc);
  const heldTopUp = take - heldAllocation;

  return {
    ok: true,
    skipped: false,
    balances: {
      allocationBalance: restoredAlloc - heldAllocation,
      topUpBalance: restoredTop - heldTopUp,
    },
    debitAmount: billed,
    status: 'settled',
    heldAllocation,
    heldTopUp,
  };
}

export type ReleaseResult =
  | { ok: true; skipped: true }
  | {
      ok: true;
      skipped: false;
      balances: BucketBalances;
      status: 'released';
    };

export function applyRelease(
  balances: BucketBalances,
  job: JobRecord | undefined
): ReleaseResult {
  if (!job || (job.status !== 'reserved' && job.status !== 'submitted')) {
    return { ok: true, skipped: true };
  }
  return {
    ok: true,
    skipped: false,
    balances: {
      allocationBalance: balances.allocationBalance + job.heldAllocation,
      topUpBalance: balances.topUpBalance + job.heldTopUp,
    },
    status: 'released',
  };
}

export type CaptureResult =
  | { ok: true; skipped: true }
  | {
      ok: true;
      skipped: false;
      balances: BucketBalances;
      settledCredits: number;
      heldAllocation: number;
      heldTopUp: number;
      refund: number;
      overReserve: boolean;
    };

/**
 * Second pass after provisional settle. final = min(Fal credits, reserve,
 * already charged) — refund only, never a surcharge. Idempotent once
 * `captured` is set. Fal billed above reserve → overReserve, no extra charge.
 */
export function applyCapture(
  balances: BucketBalances,
  job: JobRecord | undefined,
  falCredits: number
): CaptureResult {
  if (!job || job.status !== 'settled' || job.captured) {
    return { ok: true, skipped: true };
  }
  const already =
    job.settledCredits ??
    (Number.isInteger(job.heldAllocation + job.heldTopUp)
      ? job.heldAllocation + job.heldTopUp
      : job.estimatedCredits);
  const fal = Number.isInteger(falCredits) && falCredits > 0 ? falCredits : 0;
  const overReserve = fal > job.estimatedCredits;
  const final = Math.min(fal, job.estimatedCredits, already);
  const refund = already - final;
  let fromTop = Math.min(refund, job.heldTopUp);
  let fromAlloc = refund - fromTop;
  if (fromAlloc > job.heldAllocation) {
    fromTop += fromAlloc - job.heldAllocation;
    fromAlloc = job.heldAllocation;
  }
  return {
    ok: true,
    skipped: false,
    balances: {
      allocationBalance: balances.allocationBalance + fromAlloc,
      topUpBalance: balances.topUpBalance + fromTop,
    },
    settledCredits: final,
    heldAllocation: job.heldAllocation - fromAlloc,
    heldTopUp: job.heldTopUp - fromTop,
    refund,
    overReserve,
  };
}

/** Firestore documents cannot contain undefined. */
export function omitUndefined(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
