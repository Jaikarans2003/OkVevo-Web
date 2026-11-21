/**
 * Pure reserve/reconcile math. Firestore wrappers live in debit.ts.
 * Three-bucket FIFO: allocation → topUp → sponsored.
 * An account with sponsoredBalance 0 (or omitted) and creditLimit 0 stays
 * byte-identical to the pre-2b-a two-bucket path for alloc+topUp.
 * No 'reserve' transaction type — billing only sees grant/debit/refund.
 */

export type GatewayProvider = 'openrouter' | 'fal' | 'tavily';

/**
 * Chat/Tavily holds use `reserved` until settle.
 * Fal queue holds use queued → dispatching → submitted → settled | released, plus unknown.
 */
export type JobStatus =
  | 'reserved'
  | 'queued'
  | 'dispatching'
  | 'submitted'
  | 'unknown'
  | 'settled'
  | 'released';

export type BucketBalances = {
  allocationBalance: number;
  topUpBalance: number;
  /** Omitted or 0 = pre-2b-a two-bucket behaviour. */
  sponsoredBalance?: number;
};

export type JobRecord = {
  uid: string;
  provider: GatewayProvider;
  estimatedCredits: number;
  status: JobStatus;
  heldAllocation: number;
  heldTopUp: number;
  heldSponsored?: number;
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

function sponsoredOf(b: BucketBalances): number {
  return b.sponsoredBalance ?? 0;
}

function heldSponsoredOf(job: JobRecord): number {
  return job.heldSponsored ?? 0;
}

/**
 * FIFO: allocation → topUp → sponsored.
 * `creditLimit` (default 0) lets sponsored go down to `-creditLimit` for
 * prepaid child orgs (§5.2 / 2b-a). topUp never goes below 0.
 * creditLimit=0 and sponsored=0 is byte-identical to pre-2b-a alloc+topUp.
 */
function splitFifo(
  need: number,
  allocation: number,
  topUp: number,
  sponsored: number,
  creditLimit = 0
): {
  heldAllocation: number;
  heldTopUp: number;
  heldSponsored: number;
  balances: BucketBalances;
} | null {
  if (!Number.isInteger(need) || need < 0) return null;
  if (!Number.isInteger(allocation) || allocation < 0) return null;
  if (!Number.isInteger(topUp) || topUp < 0) return null;
  if (!Number.isInteger(sponsored)) return null;
  if (!Number.isInteger(creditLimit) || creditLimit < 0) return null;
  const floor = creditLimit > 0 ? -creditLimit : 0;
  if (sponsored < floor) return null;
  if (need === 0) {
    return {
      heldAllocation: 0,
      heldTopUp: 0,
      heldSponsored: 0,
      balances: {
        allocationBalance: allocation,
        topUpBalance: topUp,
        sponsoredBalance: sponsored,
      },
    };
  }
  const available = allocation + topUp + sponsored - floor;
  if (available < need) return null;
  const heldAllocation = Math.min(need, allocation);
  let left = need - heldAllocation;
  const heldTopUp = Math.min(left, topUp);
  left -= heldTopUp;
  const heldSponsored = left;
  return {
    heldAllocation,
    heldTopUp,
    heldSponsored,
    balances: {
      allocationBalance: allocation - heldAllocation,
      topUpBalance: topUp - heldTopUp,
      sponsoredBalance: sponsored - heldSponsored,
    },
  };
}

export function applyReserve(
  balances: BucketBalances,
  existing: JobRecord | undefined,
  estimated: number,
  uid: string,
  provider: GatewayProvider,
  creditLimit = 0
): ReserveOk | ReserveFail {
  if (existing) return { ok: false, reason: 'duplicate' };
  const split = splitFifo(
    estimated,
    balances.allocationBalance,
    balances.topUpBalance,
    sponsoredOf(balances),
    creditLimit
  );
  if (!split) return { ok: false, reason: 'insufficient' };
  const outBalances: BucketBalances = {
    allocationBalance: split.balances.allocationBalance,
    topUpBalance: split.balances.topUpBalance,
  };
  // Omit sponsoredBalance when it was omitted/0 and stayed 0 — keeps selfcheck shapes.
  if ((balances.sponsoredBalance ?? 0) !== 0 || split.heldSponsored !== 0) {
    outBalances.sponsoredBalance = split.balances.sponsoredBalance;
  }
  const job: JobRecord = {
    uid,
    provider,
    estimatedCredits: estimated,
    status: 'reserved',
    heldAllocation: split.heldAllocation,
    heldTopUp: split.heldTopUp,
  };
  if (split.heldSponsored !== 0) job.heldSponsored = split.heldSponsored;
  return { ok: true, balances: outBalances, job };
}

export type ReconcileResult =
  | { ok: true; skipped: true }
  | {
      ok: true;
      skipped: false;
      balances: BucketBalances;
      /** Billed credits (job actualCredits). */
      debitAmount: number;
      /** Credits actually taken from the wallet (= debitAmount - absorbed). */
      walletDebit: number;
      /** Billed beyond what the wallet could cover — OkVevo eats it. */
      absorbed: number;
      status: 'settled';
      heldAllocation: number;
      heldTopUp: number;
      heldSponsored: number;
    };

function canSettle(job: JobRecord): boolean {
  if (job.provider === 'fal') return job.status === 'submitted';
  return job.status === 'reserved' || job.status === 'submitted';
}

export function applyReconcile(
  balances: BucketBalances,
  job: JobRecord | undefined,
  actual: number,
  creditLimit = 0
): ReconcileResult {
  if (!job || !canSettle(job)) {
    return { ok: true, skipped: true };
  }
  const billed = Number.isInteger(actual) && actual > 0 ? actual : 0;
  const restoredAlloc = balances.allocationBalance + job.heldAllocation;
  const restoredTop = balances.topUpBalance + job.heldTopUp;
  const restoredSponsored = sponsoredOf(balances) + heldSponsoredOf(job);
  const floor = creditLimit > 0 ? -creditLimit : 0;
  const available = restoredAlloc + restoredTop + restoredSponsored - floor;
  const take = Math.min(billed, Math.max(0, available));
  const heldAllocation = Math.min(take, restoredAlloc);
  let left = take - heldAllocation;
  const heldTopUp = Math.min(left, restoredTop);
  left -= heldTopUp;
  const heldSponsored = left;

  const outBalances: BucketBalances = {
    allocationBalance: restoredAlloc - heldAllocation,
    topUpBalance: restoredTop - heldTopUp,
  };
  if ((balances.sponsoredBalance ?? 0) !== 0 || heldSponsored !== 0 || heldSponsoredOf(job) !== 0) {
    outBalances.sponsoredBalance = restoredSponsored - heldSponsored;
  }

  return {
    ok: true,
    skipped: false,
    balances: outBalances,
    debitAmount: billed,
    walletDebit: take,
    absorbed: billed - take,
    status: 'settled',
    heldAllocation,
    heldTopUp,
    heldSponsored,
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

export const RELEASABLE: ReadonlySet<JobStatus> = new Set([
  'reserved',
  'queued',
  'dispatching',
  'submitted',
  'unknown',
]);

export function applyRelease(
  balances: BucketBalances,
  job: JobRecord | undefined
): ReleaseResult {
  if (!job || !RELEASABLE.has(job.status)) {
    return { ok: true, skipped: true };
  }
  const out: BucketBalances = {
    allocationBalance: balances.allocationBalance + job.heldAllocation,
    topUpBalance: balances.topUpBalance + job.heldTopUp,
  };
  const hs = heldSponsoredOf(job);
  if ((balances.sponsoredBalance ?? 0) !== 0 || hs !== 0) {
    out.sponsoredBalance = sponsoredOf(balances) + hs;
  }
  return { ok: true, skipped: false, balances: out, status: 'released' };
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
      heldSponsored: number;
      refund: number;
      overReserve: boolean;
    };

/**
 * Second pass after provisional settle. final = min(Fal credits, reserve,
 * already charged) — refund only, never a surcharge. Idempotent once
 * `captured` is set. Fal billed above reserve → overReserve, no extra charge.
 * Refund order: sponsored → topUp → allocation (reverse of spend).
 */
export function applyCapture(
  balances: BucketBalances,
  job: JobRecord | undefined,
  falCredits: number
): CaptureResult {
  if (!job || job.status !== 'settled' || job.captured) {
    return { ok: true, skipped: true };
  }
  const hs0 = heldSponsoredOf(job);
  const already =
    job.settledCredits ??
    (Number.isInteger(job.heldAllocation + job.heldTopUp + hs0)
      ? job.heldAllocation + job.heldTopUp + hs0
      : job.estimatedCredits);
  const fal = Number.isInteger(falCredits) && falCredits > 0 ? falCredits : 0;
  const overReserve = fal > job.estimatedCredits;
  const final = Math.min(fal, job.estimatedCredits, already);
  const refund = already - final;
  let left = refund;
  let fromSponsored = Math.min(left, hs0);
  left -= fromSponsored;
  let fromTop = Math.min(left, job.heldTopUp);
  left -= fromTop;
  let fromAlloc = left;
  if (fromAlloc > job.heldAllocation) {
    fromTop += fromAlloc - job.heldAllocation;
    fromAlloc = job.heldAllocation;
  }
  const out: BucketBalances = {
    allocationBalance: balances.allocationBalance + fromAlloc,
    topUpBalance: balances.topUpBalance + fromTop,
  };
  if ((balances.sponsoredBalance ?? 0) !== 0 || fromSponsored !== 0 || hs0 !== 0) {
    out.sponsoredBalance = sponsoredOf(balances) + fromSponsored;
  }
  return {
    ok: true,
    skipped: false,
    balances: out,
    settledCredits: final,
    heldAllocation: job.heldAllocation - fromAlloc,
    heldTopUp: job.heldTopUp - fromTop,
    heldSponsored: hs0 - fromSponsored,
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
