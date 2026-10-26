import { createHash } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import { decideIdempotency, type IdemRow } from '@/lib/fal/idempotency';
import { canTransition } from '@/lib/fal/jobMachine';

import { applySpendClose, applySpendRelease } from '@/lib/fal/dramaSwitches';
import { admit, parseQueue, QueueFullError, slotsForPlan } from '@/lib/fal/falQueue';
import { db } from '@/lib/firebase-admin';
import { captureCreditsOn } from '@/lib/gateway/captureCredits';
import { nextAllocationGrantedTotal, nextTopUpPurchasedTotal } from '@/types/credits';
import { clampDebitAmount, creditsFromTokens, hasPositiveRates, isRouterAliasModel, lookupModelRates, settleBillModel } from '@/lib/gateway/pricing';
import {
  chatConcurrencyBlocked,
  denialForFailedReserve,
  summarizeOpenHolds,
} from '@/lib/gateway/reserveDenial';
import {
  applyReconcile,
  applyRelease,
  applyReserve,
  RELEASABLE,
  type BucketBalances,
  type GatewayProvider,
  type JobRecord,
  type JobStatus,
  omitUndefined,
} from '@/lib/gateway/reserve';
import { tokenCounts, type UsageScan } from '@/lib/gateway/sse';

function readInt(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

/**
 * Read two buckets. One-time migrate: legacy creditBalance → topUpBalance
 * when both new buckets are absent/zero and creditBalance > 0.
 */
export function readBalances(data: FirebaseFirestore.DocumentData | undefined): BucketBalances {
  if (!data) return { allocationBalance: 0, topUpBalance: 0 };
  const allocation = readInt(data.allocationBalance);
  let topUp = readInt(data.topUpBalance);
  const legacy = readInt(data.creditBalance);
  // Migrate only when new fields were never seeded (both 0) and legacy remains.
  if (allocation === 0 && topUp === 0 && legacy > 0 && data.topUpBalance === undefined) {
    topUp = legacy;
  }
  return { allocationBalance: allocation, topUpBalance: topUp };
}

function readPlanStatus(data: FirebaseFirestore.DocumentData | undefined): string | null {
  const s = data?.planStatus;
  return typeof s === 'string' ? s : null;
}

export function jobFromSnap(data: FirebaseFirestore.DocumentData | undefined): JobRecord | undefined {
  if (!data) return undefined;
  const status = data.status;
  const provider = data.provider;
  const estimated = data.estimatedCredits;
  const uid = data.uid;
  if (
    status !== 'reserved' &&
    status !== 'queued' &&
    status !== 'dispatching' &&
    status !== 'submitted' &&
    status !== 'unknown' &&
    status !== 'settled' &&
    status !== 'released'
  ) {
    return undefined;
  }
  if (provider !== 'openrouter' && provider !== 'fal' && provider !== 'tavily') return undefined;
  if (typeof uid !== 'string' || !uid) return undefined;
  if (typeof estimated !== 'number' || !Number.isInteger(estimated) || estimated < 0) {
    return undefined;
  }
  const heldAllocation = readInt(data.heldAllocation);
  const heldTopUp = readInt(data.heldTopUp);
  // Legacy jobs without hold split: treat entire hold as allocation
  const hasSplit = data.heldAllocation !== undefined || data.heldTopUp !== undefined;
  return {
    uid,
    provider,
    estimatedCredits: estimated,
    status,
    heldAllocation: hasSplit ? heldAllocation : estimated,
    heldTopUp: hasSplit ? heldTopUp : 0,
    settledCredits: typeof data.settledCredits === 'number' ? data.settledCredits : undefined,
    captured: data.captured === true,
  };
}

export class InsufficientCreditsError extends Error {
  readonly code = 'insufficient_quota' as const;
  constructor() {
    super('insufficient credits');
    this.name = 'InsufficientCreditsError';
  }
}

export class PlanNotActiveError extends Error {
  readonly code = 'plan_not_active' as const;
  constructor() {
    super('plan not active');
    this.name = 'PlanNotActiveError';
  }
}

export class InFlightBudgetError extends Error {
  readonly code = 'in_flight_budget_exhausted' as const;
  constructor() {
    super('in flight budget exhausted');
    this.name = 'InFlightBudgetError';
  }
}

export class PlanConcurrencyError extends Error {
  readonly code = 'plan_concurrency_limit' as const;
  constructor() {
    super('plan concurrency limit');
    this.name = 'PlanConcurrencyError';
  }
}

/**
 * Open holds for this user. Null when the query cannot run (index still
 * building): callers then keep today's 402 instead of failing the reserve.
 * ponytail: read just before the transaction, so two parallel chats can both
 * pass a slot check. Upgrade: run the query inside the transaction.
 */
async function listOpenHolds(uid: string): Promise<{ held: number; openChat: number } | null> {
  try {
    const snap = await db
      .collection('gatewayJobs')
      .where('uid', '==', uid)
      .where('status', 'in', [...RELEASABLE])
      .get();
    return summarizeOpenHolds(snap.docs.map((doc) => doc.data()));
  } catch (err) {
    console.error('gateway: open hold query failed', err);
    return null;
  }
}

type SpendHoldRead = {
  spendRef: FirebaseFirestore.DocumentReference;
  spendSnap: FirebaseFirestore.DocumentSnapshot;
  reservedFalUsd: number;
};

/** Read spendDaily before any write in the same reserve transaction. */
async function readSpendForHold(
  tx: FirebaseFirestore.Transaction,
  extra: Record<string, unknown> | undefined
): Promise<SpendHoldRead | null> {
  const reservedFalUsd = Number(extra?.reservedFalUsd ?? 0);
  const spendDay = typeof extra?.spendDay === 'string' ? extra.spendDay : '';
  if (!(reservedFalUsd > 0) || !spendDay) return null;
  const spendRef = db.collection('spendDaily').doc(spendDay);
  const spendSnap = await tx.get(spendRef);
  return { spendRef, spendSnap, reservedFalUsd };
}

function applySpendHold(tx: FirebaseFirestore.Transaction, spend: SpendHoldRead | null): void {
  if (!spend) return;
  tx.set(spend.spendRef, { falUsdHeld: FieldValue.increment(spend.reservedFalUsd) }, { merge: true });
}

type SpendReleaseRead = {
  spendRef: FirebaseFirestore.DocumentReference;
  spendSnap: FirebaseFirestore.DocumentSnapshot;
  reservedFalUsd: number;
};

export async function loadSpendRelease(
  tx: FirebaseFirestore.Transaction,
  data: FirebaseFirestore.DocumentData | undefined
): Promise<SpendReleaseRead | null> {
  const reservedFalUsd = Number(data?.reservedFalUsd ?? 0);
  const spendDay = typeof data?.spendDay === 'string' ? data.spendDay : '';
  if (!(reservedFalUsd > 0) || !spendDay) return null;
  const spendRef = db.collection('spendDaily').doc(spendDay);
  const spendSnap = await tx.get(spendRef);
  return { spendRef, spendSnap, reservedFalUsd };
}

export function writeSpendRelease(tx: FirebaseFirestore.Transaction, spend: SpendReleaseRead | null): void {
  if (!spend) return;
  tx.set(
    spend.spendRef,
    applySpendRelease(spend.spendSnap.data(), spend.reservedFalUsd),
    { merge: true }
  );
}

export type GatewayJobFields = {
  uid: string;
  provider: GatewayProvider;
  estimatedCredits: number;
  status: JobRecord['status'];
  heldAllocation?: number;
  heldTopUp?: number;
  endpoint?: string;
  unit?: string;
  unitPrice?: number;
  submitArgs?: Record<string, unknown>;
  falStatusUrl?: string;
  falResponseUrl?: string;
  falCancelUrl?: string;
  holdId?: string;
  payload?: unknown;
  character?: string;
  project?: string;
  consentAt?: string;
  sampleSha256?: string;
  /** Server-measured reference media recorded at submit (drama rate-card jobs). */
  media?: {
    videos: { seconds: number }[];
    audios: { seconds: number }[];
    images: { width: number; height: number }[];
  };
  priceSnapshot?: {
    endpoint: string;
    unit: string;
    unitPrice: number;
    source: string;
    fetchedAt: string;
    rawUsd: number;
  };
  reservedFalUsd?: number;
  spendDay?: string;
};

/**
 * Decrement buckets (FIFO) and write gatewayJobs/{requestId} as reserved.
 * Spend gate: planStatus must be 'active'.
 *
 * ponytail: reserved jobs stay held until webhook/poll/release. Stuck if Fal
 * never completes. Upgrade: TTL sweeper that releases expired reserved jobs.
 */
export async function reserveCredits(opts: {
  uid: string;
  requestId: string;
  provider: GatewayProvider;
  estimatedCredits: number;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const { uid, requestId, provider, estimatedCredits, extra } = opts;
  if (!uid || !requestId) throw new Error('uid and requestId required');

  const userRef = db.collection('users').doc(uid);
  const jobRef = db.collection('gatewayJobs').doc(requestId);
  const holds = await listOpenHolds(uid);

  await db.runTransaction(async (tx) => {
    const spend = await readSpendForHold(tx, extra);
    const jobSnap = await tx.get(jobRef);
    const userSnap = await tx.get(userRef);
    const data = userSnap.data();
    if (readPlanStatus(data) !== 'active') {
      throw new PlanNotActiveError();
    }
    if (provider === 'openrouter' && holds) {
      const plan = slotsForPlan(data?.plan, readPlanStatus(data));
      if (plan.admit && chatConcurrencyBlocked(holds.openChat, plan.slots)) {
        throw new PlanConcurrencyError();
      }
    }
    const balances = readBalances(data);
    const result = applyReserve(
      balances,
      jobFromSnap(jobSnap.data()),
      estimatedCredits,
      uid,
      provider
    );
    if (!result.ok) {
      if (result.reason === 'duplicate') return;
      if (
        holds &&
        denialForFailedReserve({
          spendable: balances.allocationBalance + balances.topUpBalance,
          estimated: estimatedCredits,
          inFlightHeld: holds.held,
        }) === 'in_flight_budget_exhausted'
      ) {
        throw new InFlightBudgetError();
      }
      throw new InsufficientCreditsError();
    }
    applySpendHold(tx, spend);
    tx.set(
      userRef,
      {
        allocationBalance: result.balances.allocationBalance,
        topUpBalance: result.balances.topUpBalance,
      },
      { merge: true }
    );
    tx.set(jobRef, {
      uid,
      provider,
      estimatedCredits: result.job.estimatedCredits,
      heldAllocation: result.job.heldAllocation,
      heldTopUp: result.job.heldTopUp,
      status: 'reserved',
      createdAt: FieldValue.serverTimestamp(),
      ...(extra ?? {}),
    });
  });
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('idempotency conflict');
    this.name = 'IdempotencyConflictError';
  }
}

export function falRunDocId(uid: string, runId: string): string {
  return createHash('sha256').update(`${uid}\0${runId}`).digest('hex');
}

/** Read-only idempotency check. Never creates a hold. */
export async function peekFalRun(
  uid: string,
  runId: string,
  bodyHash: string
): Promise<{
  action: 'create' | 'continue' | 'replay' | 'unknown' | 'conflict';
  holdId?: string;
  falRequestId?: string;
}> {
  const snap = await db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId)).get();
  const existing = snap.exists ? (snap.data() as IdemRow) : undefined;
  const decision = decideIdempotency(existing, bodyHash);
  if (decision.action === 'conflict' || decision.action === 'create') {
    return { action: decision.action };
  }
  return {
    action: decision.action,
    holdId: decision.row.holdId,
    falRequestId: decision.row.falRequestId,
  };
}

/**
 * Check the run key, create the hold, and record the row in one transaction.
 * Replay and conflict do not reserve again.
 */
export async function reserveFalRun(opts: {
  uid: string;
  runId: string;
  bodyHash: string;
  estimatedCredits: number;
  extra?: Record<string, unknown>;
}): Promise<{
  kind: 'created' | 'continue' | 'replay' | 'unknown';
  holdId: string;
  falRequestId?: string;
  placement?: 'running' | 'queued';
  position?: number;
  slotsInUse?: number;
  slotsLimit?: number;
}> {
  const idemRef = db.collection('gatewayIdempotency').doc(falRunDocId(opts.uid, opts.runId));
  return db.runTransaction(async (tx) => {
    const spend = await readSpendForHold(tx, opts.extra);
    const idemSnap = await tx.get(idemRef);
    const existing = idemSnap.exists ? (idemSnap.data() as IdemRow) : undefined;
    const decision = decideIdempotency(existing, opts.bodyHash);
    if (decision.action === 'conflict') throw new IdempotencyConflictError();
    if (decision.action !== 'create') {
      return {
        kind: decision.action === 'continue' ? 'continue' : decision.action,
        holdId: decision.row.holdId,
        falRequestId: decision.row.falRequestId,
      };
    }
    const holdId = crypto.randomUUID();
    const userRef = db.collection('users').doc(opts.uid);
    const jobRef = db.collection('gatewayJobs').doc(holdId);
    const queueRef = db.collection('falQueue').doc(opts.uid);
    const jobSnap = await tx.get(jobRef);
    const userSnap = await tx.get(userRef);
    const queueSnap = await tx.get(queueRef);
    const data = userSnap.data();
    const plan = slotsForPlan(data?.plan, readPlanStatus(data));
    if (!plan.admit) throw new PlanNotActiveError();
    const admitted = admit(parseQueue(queueSnap.data()), holdId, plan.slots);
    if (!admitted.ok) throw new QueueFullError();
    const result = applyReserve(
      readBalances(data),
      jobFromSnap(jobSnap.data()),
      opts.estimatedCredits,
      opts.uid,
      'fal'
    );
    if (!result.ok) {
      if (result.reason === 'duplicate') throw new IdempotencyConflictError();
      throw new InsufficientCreditsError();
    }
    applySpendHold(tx, spend);
    tx.set(
      userRef,
      {
        allocationBalance: result.balances.allocationBalance,
        topUpBalance: result.balances.topUpBalance,
      },
      { merge: true }
    );
    tx.set(
      queueRef,
      {
        running: admitted.state.running,
        queued: admitted.state.queued,
        queuedCount: admitted.state.queued.length,
        needsSubmit: admitted.placement === 'running' || queueSnap.data()?.needsSubmit === true,
      },
      { merge: true }
    );
    tx.set(jobRef, {
      uid: opts.uid,
      provider: 'fal',
      estimatedCredits: result.job.estimatedCredits,
      heldAllocation: result.job.heldAllocation,
      heldTopUp: result.job.heldTopUp,
      status: 'queued',
      queuePosition: admitted.position,
      createdAt: FieldValue.serverTimestamp(),
      ...(opts.extra ?? {}),
    });
    tx.set(idemRef, {
      uid: opts.uid,
      runId: opts.runId,
      bodyHash: opts.bodyHash,
      phase: 'queued',
      submitStarted: false,
      holdId,
    });
    return {
      kind: 'created' as const,
      holdId,
      placement: admitted.placement,
      position: admitted.position,
      slotsInUse: admitted.slotsInUse,
      slotsLimit: plan.slots,
    };
  });
}

/**
 * Compare-and-set so two retries do not both call Fal.
 * Refuses anything that is not `dispatching`, and a job cancelled before send.
 */
export async function claimFalSubmit(
  uid: string,
  runId: string,
  holdId: string
): Promise<'claimed' | 'cancelled' | 'busy'> {
  const idemRef = db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId));
  const jobRef = db.collection('gatewayJobs').doc(holdId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(idemRef);
    const jobSnap = await tx.get(jobRef);
    if (jobSnap.data()?.status !== 'dispatching') return 'busy';
    const row = snap.data();
    if (!row || row.submitStarted === true) return 'busy';
    if (jobSnap.data()?.cancelRequested === true) return 'cancelled';
    tx.set(idemRef, { submitStarted: true, phase: 'dispatching' }, { merge: true });
    return 'claimed';
  });
}

/** Status write. Refuses when `from` is not the current state or the edge is illegal. */
export async function transitionGatewayJob(
  requestId: string,
  from: readonly JobStatus[],
  to: JobStatus,
  patch: Record<string, unknown> = {},
  idem?: { uid: string; runId: string; patch: Record<string, unknown> }
): Promise<boolean> {
  const jobRef = db.collection('gatewayJobs').doc(requestId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    const status = snap.data()?.status;
    if (typeof status !== 'string' || !from.includes(status as JobStatus)) return false;
    if (!canTransition(status, to)) return false;
    const idemSnap = idem
      ? await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(idem.uid, idem.runId)))
      : null;
    tx.set(jobRef, { status: to, ...patch }, { merge: true });
    if (idem && idemSnap) {
      tx.set(idemSnap.ref, idem.patch, { merge: true });
    }
    return true;
  });
}

/** dispatching → submitted, plus the Fal id alias, in one transaction. */
export async function commitFalSubmitted(opts: {
  holdId: string;
  uid: string;
  runId: string;
  falRequestId: string;
  falStatusUrl: string;
  falResponseUrl: string;
  falCancelUrl: string;
}): Promise<{ ok: boolean; cancelRequested: boolean }> {
  const jobRef = db.collection('gatewayJobs').doc(opts.holdId);
  const idemRef = db.collection('gatewayIdempotency').doc(falRunDocId(opts.uid, opts.runId));
  const aliasRef = db.collection('gatewayJobs').doc(opts.falRequestId);
  return db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const status = jobSnap.data()?.status;
    if (status !== 'dispatching' || !canTransition('dispatching', 'submitted')) {
      return { ok: false, cancelRequested: false };
    }
    const aliasSnap = opts.falRequestId === opts.holdId ? null : await tx.get(aliasRef);
    const cancelRequested = jobSnap.data()?.cancelRequested === true;
    if (aliasSnap && !aliasSnap.exists) {
      tx.set(aliasRef, { aliasOf: opts.holdId, uid: opts.uid });
    }
    tx.set(
      jobRef,
      {
        status: 'submitted',
        falRequestId: opts.falRequestId,
        falStatusUrl: opts.falStatusUrl,
        falResponseUrl: opts.falResponseUrl,
        falCancelUrl: opts.falCancelUrl,
      },
      { merge: true }
    );
    tx.set(
      idemRef,
      { phase: 'submitted', falRequestId: opts.falRequestId, submitStarted: true },
      { merge: true }
    );
    return { ok: true, cancelRequested };
  });
}

export async function markFalRun(
  uid: string,
  runId: string,
  patch: { phase: 'submitted' | 'unknown' | 'released'; falRequestId?: string }
): Promise<void> {
  await db.collection('gatewayIdempotency').doc(falRunDocId(uid, runId)).set(patch, { merge: true });
}

/** Move a reserved hold to Fal's request_id so webhook lookup is gatewayJobs/{falId}. */
export async function rebindGatewayJob(fromId: string, toId: string): Promise<void> {
  if (!fromId || !toId || fromId === toId) return;
  const fromRef = db.collection('gatewayJobs').doc(fromId);
  const toRef = db.collection('gatewayJobs').doc(toId);

  await db.runTransaction(async (tx) => {
    const fromSnap = await tx.get(fromRef);
    if (!fromSnap.exists) return;
    const toSnap = await tx.get(toRef);
    if (toSnap.exists) {
      tx.delete(fromRef);
      return;
    }
    tx.set(toRef, { ...fromSnap.data(), holdId: fromId, requestId: toId });
    tx.delete(fromRef);
  });
}

export async function readGatewayJob(
  requestId: string
): Promise<(GatewayJobFields & {
  id: string;
  runId?: string;
  falBody?: Record<string, unknown>;
  falRequestId?: string;
  queuePosition?: number;
  releaseReason?: string;
  clientMessage?: string;
  cancelRequested?: boolean;
  submitAttempts?: number;
  firstRejectAtMs?: number | null;
  nextAttemptAtMs?: number | null;
}) | null> {
  const snap = await db.collection('gatewayJobs').doc(requestId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (typeof data.aliasOf === 'string' && data.aliasOf && data.aliasOf !== requestId) {
    return readGatewayJob(data.aliasOf);
  }
  const job = jobFromSnap(data);
  if (!job) return null;
  return {
    id: snap.id,
    ...job,
    endpoint: typeof data.endpoint === 'string' ? data.endpoint : undefined,
    unit: typeof data.unit === 'string' ? data.unit : undefined,
    unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : undefined,
    submitArgs:
      data.submitArgs && typeof data.submitArgs === 'object'
        ? (data.submitArgs as Record<string, unknown>)
        : undefined,
    falBody:
      data.falBody && typeof data.falBody === 'object'
        ? (data.falBody as Record<string, unknown>)
        : undefined,
    runId: typeof data.runId === 'string' ? data.runId : undefined,
    falRequestId: typeof data.falRequestId === 'string' ? data.falRequestId : undefined,
    releaseReason: typeof data.releaseReason === 'string' ? data.releaseReason : undefined,
    clientMessage: typeof data.clientMessage === 'string' ? data.clientMessage : undefined,
    cancelRequested: data.cancelRequested === true,
    submitAttempts: typeof data.submitAttempts === 'number' ? data.submitAttempts : 0,
    firstRejectAtMs: typeof data.firstRejectAtMs === 'number' ? data.firstRejectAtMs : null,
    nextAttemptAtMs: typeof data.nextAttemptAtMs === 'number' ? data.nextAttemptAtMs : null,
    queuePosition: typeof data.queuePosition === 'number' ? data.queuePosition : undefined,
    falStatusUrl: typeof data.falStatusUrl === 'string' ? data.falStatusUrl : undefined,
    falResponseUrl: typeof data.falResponseUrl === 'string' ? data.falResponseUrl : undefined,
    falCancelUrl: typeof data.falCancelUrl === 'string' ? data.falCancelUrl : undefined,
    holdId: typeof data.holdId === 'string' ? data.holdId : undefined,
    payload: data.payload,
    character: typeof data.character === 'string' ? data.character : undefined,
    project: typeof data.project === 'string' ? data.project : undefined,
    consentAt: typeof data.consentAt === 'string' ? data.consentAt : undefined,
    sampleSha256: typeof data.sampleSha256 === 'string' ? data.sampleSha256 : undefined,
    priceSnapshot: isPriceSnapshot(data.priceSnapshot) ? data.priceSnapshot : undefined,
    media:
      data.media && typeof data.media === 'object'
        ? (data.media as GatewayJobFields['media'])
        : undefined,
    reservedFalUsd: typeof data.reservedFalUsd === 'number' ? data.reservedFalUsd : undefined,
    spendDay: typeof data.spendDay === 'string' ? data.spendDay : undefined,
  };
}

function isPriceSnapshot(value: unknown): value is GatewayJobFields['priceSnapshot'] {
  const rec = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  return !!rec && typeof rec.endpoint === 'string' && typeof rec.rawUsd === 'number';
}

export async function patchGatewayJob(
  requestId: string,
  patch: Record<string, unknown>
): Promise<void> {
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    throw new Error('job status is compare-and-set only');
  }
  await db.collection('gatewayJobs').doc(requestId).set(patch, { merge: true });
}

/**
 * Write one debit for actual credits; refund unused reserve or extra-decrement.
 * Idempotent on creditTransactions/{requestId}.
 */
export async function reconcileCredits(opts: {
  requestId: string;
  actualCredits: number;
  provider: GatewayProvider;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  priceUsd?: number;
}): Promise<void> {
  const { requestId, actualCredits, provider } = opts;
  if (!requestId) return;

  const jobRef = db.collection('gatewayJobs').doc(requestId);
  const txnRef = db.collection('creditTransactions').doc(requestId);

  await db.runTransaction(async (tx) => {
    const txnSnap = await tx.get(txnRef);
    if (txnSnap.exists) return;

    const jobSnap = await tx.get(jobRef);
    const job = jobFromSnap(jobSnap.data());
    if (!job) return;
    const jobData = jobSnap.data();
    const spendDay = typeof jobData?.spendDay === 'string' ? jobData.spendDay : '';
    const reservedFalUsd = Number(jobData?.reservedFalUsd ?? 0);
    const spendRef = spendDay ? db.collection('spendDaily').doc(spendDay) : null;
    const spendSnap = spendRef ? await tx.get(spendRef) : null;

    const userRef = db.collection('users').doc(job.uid);
    const userSnap = await tx.get(userRef);
    const data = userSnap.data();
    if (readPlanStatus(data) !== 'active') {
      // Still settle the hold split back if plan lapsed mid-flight — release path preferred.
      // Plan: reconcile requires active; release unused instead.
      const released = applyRelease(readBalances(data), job);
      if (!released.skipped) {
        if (spendRef && spendSnap) {
          tx.set(
            spendRef,
            applySpendRelease(spendSnap.data(), reservedFalUsd),
            { merge: true }
          );
        }
        tx.set(
          userRef,
          {
            allocationBalance: released.balances.allocationBalance,
            topUpBalance: released.balances.topUpBalance,
          },
          { merge: true }
        );
        tx.set(jobRef, { status: 'released' }, { merge: true });
      }
      return;
    }

    const result = applyReconcile(readBalances(data), job, actualCredits);
    if (result.skipped) return;

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
        status: 'settled',
        captured: false,
        actualCredits: result.debitAmount,
        heldAllocation: result.heldAllocation,
        heldTopUp: result.heldTopUp,
      },
      { merge: true }
    );
    if (spendRef && spendSnap) {
      tx.set(
        spendRef,
        applySpendClose(spendSnap.data(), {
          reservedFalUsd,
          settledRawUsd: opts.priceUsd ?? 0,
          actualCredits: result.debitAmount,
        }),
        { merge: true }
      );
    }
    if (result.debitAmount <= 0) return;

    const amount = clampDebitAmount(result.debitAmount, result.debitAmount);
    tx.set(
      txnRef,
      omitUndefined({
        uid: job.uid,
        type: 'debit',
        amount,
        provider,
        model: opts.model,
        promptTokens: opts.promptTokens,
        completionTokens: opts.completionTokens,
        costUsd: opts.costUsd,
        priceUsd: opts.priceUsd,
        requestId,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
  });
}

/**
 * Capture pass: Fal billing-events cost_total → min(credits, reserve).
 * Refunds via the same wallet CAS as collect. Idempotent on captured=true
 * and creditTransactions/{requestId}:capture.
 */
export async function captureCredits(opts: {
  requestId: string;
  falUsd: number;
  falCredits: number;
}): Promise<{ skipped: boolean; refund: number; overReserve: boolean }> {
  return captureCreditsOn(db, opts);
}

const DEFAULT_RELEASE_FROM: readonly JobStatus[] = ['reserved', 'submitted', 'queued'];

/**
 * Restore held split to buckets; no debit. Idempotent.
 * `from` is the compare-and-set guard. Dispatching is not in the default
 * set: a cancel during dispatch must not refund until Fal confirms.
 */
export async function releaseCredits(
  requestId: string,
  opts?: {
    from?: readonly JobStatus[];
    patch?: Record<string, unknown>;
    /** A `dispatching` job is released only if the Fal submit was never claimed. */
    unsent?: boolean;
  }
): Promise<boolean> {
  if (!requestId) return false;
  const from = opts?.from ?? DEFAULT_RELEASE_FROM;
  const jobRef = db.collection('gatewayJobs').doc(requestId);

  return db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const job = jobFromSnap(jobSnap.data());
    if (!job || !from.includes(job.status)) return false;
    if (job.provider === 'fal' && !canTransition(job.status, 'released')) return false;
    let unsentIdem: FirebaseFirestore.DocumentReference | null = null;
    if (opts?.unsent && job.status === 'dispatching') {
      const runId = String(jobSnap.data()?.runId ?? '');
      if (!runId) return false;
      const idemSnap = await tx.get(db.collection('gatewayIdempotency').doc(falRunDocId(job.uid, runId)));
      if (idemSnap.data()?.submitStarted === true) return false;
      unsentIdem = idemSnap.ref;
    }
    const userRef = db.collection('users').doc(job.uid);
    const userSnap = await tx.get(userRef);
    const spend = await loadSpendRelease(tx, jobSnap.data());
    const result = applyRelease(readBalances(userSnap.data()), job);
    if (result.skipped) return false;
    writeSpendRelease(tx, spend);
    tx.set(
      userRef,
      {
        allocationBalance: result.balances.allocationBalance,
        topUpBalance: result.balances.topUpBalance,
      },
      { merge: true }
    );
    tx.set(jobRef, { status: 'released', ...(opts?.patch ?? {}) }, { merge: true });
    if (unsentIdem) tx.set(unsentIdem, { phase: 'released', submitStarted: true }, { merge: true });
    return true;
  });
}

export type GrantBucket = 'allocation' | 'topUp';

/**
 * allocation grants SET (default) or ADD (`mode: 'add'`); topUp grants ADD.
 * Idempotent when requestId is provided (creditTransactions/{requestId}).
 */
export async function grantCredits(opts: {
  uid: string;
  amount: number;
  reason: string;
  bucket: GrantBucket;
  requestId?: string;
  /** Extra user-doc fields to merge (plan metadata, nextAllocationDate, etc.). */
  userPatch?: Record<string, unknown>;
  /** allocation only. `set` (default) replaces the bucket; `add` is an upgrade delta. */
  mode?: 'set' | 'add';
}): Promise<{ allocationBalance: number; topUpBalance: number; requestId: string }> {
  const { uid, reason, bucket, userPatch } = opts;
  const mode = opts.mode ?? 'set';
  const amount = opts.amount;
  if (!uid) throw new Error('uid required');
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('amount must be a non-negative integer');
  }
  if (bucket === 'topUp' && amount <= 0) {
    throw new Error('topUp amount must be a positive integer');
  }
  if (mode === 'add' && bucket !== 'allocation') {
    throw new Error('mode add is allocation-only');
  }

  const requestId =
    opts.requestId ??
    `grant-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  const userRef = db.collection('users').doc(uid);
  const txnRef = db.collection('creditTransactions').doc(requestId);

  return db.runTransaction(async (tx) => {
    const txnSnap = await tx.get(txnRef);
    if (txnSnap.exists) {
      const userSnap = await tx.get(userRef);
      const b = readBalances(userSnap.data());
      return { ...b, requestId };
    }

    const userSnap = await tx.get(userRef);
    const userData = userSnap.data();
    const current = readBalances(userData);
    const next: BucketBalances =
      bucket === 'allocation'
        ? {
            allocationBalance:
              mode === 'add' ? current.allocationBalance + amount : amount,
            topUpBalance: current.topUpBalance,
          }
        : {
            allocationBalance: current.allocationBalance,
            topUpBalance: current.topUpBalance + amount,
          };

    tx.set(
      userRef,
      {
        allocationBalance: next.allocationBalance,
        topUpBalance: next.topUpBalance,
        ...(bucket === 'topUp'
          ? {
              topUpPurchasedTotal: nextTopUpPurchasedTotal(
                readInt(userData?.topUpPurchasedTotal),
                amount,
                next.topUpBalance
              ),
            }
          : {
              // Spend must not touch this field — missing stays on creditsIncluded until seed/next grant.
              allocationGrantedTotal: nextAllocationGrantedTotal(
                mode,
                readInt(userData?.allocationGrantedTotal),
                amount,
                next.allocationBalance
              ),
            }),
        ...(userPatch ?? {}),
      },
      { merge: true }
    );

    if (amount > 0 || mode === 'add') {
      tx.set(txnRef, {
        uid,
        type: 'grant',
        amount,
        bucket,
        requestId,
        reason,
        mode,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return { ...next, requestId };
  });
}

/** After bytes are already sent: price + reconcile the reserved job. Must not throw to the client. */
export async function settleCompletedChat(opts: {
  uid: string;
  requestId: string;
  model: string;
  scan: UsageScan;
  upstreamOk: boolean;
}): Promise<void> {
  const { requestId, model, scan, upstreamOk } = opts;
  try {
    if (!upstreamOk) {
      await releaseCredits(requestId);
      return;
    }
    const { promptTokens, completionTokens } = tokenCounts(scan.usage);
    if (promptTokens === 0 && completionTokens === 0) {
      await releaseCredits(requestId);
      return;
    }

    const billModel = settleBillModel(model, scan.model);
    const rates = billModel ? await lookupModelRates(billModel) : null;
    if (billModel && hasPositiveRates(rates)) {
      const billed = creditsFromTokens({
        promptTokens,
        completionTokens,
        promptPerToken: rates.promptPerToken,
        completionPerToken: rates.completionPerToken,
      });
      await reconcileCredits({
        requestId,
        actualCredits: billed.credits,
        provider: 'openrouter',
        model: billModel,
        promptTokens,
        completionTokens,
        costUsd: billed.costUsd,
        priceUsd: billed.rawUsd,
      });
      return;
    }

    // Completed Auto/router turn with no concrete priced model: keep the reserve
    // (do not release). Normal models without rates still release as before.
    if (isRouterAliasModel(model)) {
      const job = await readGatewayJob(requestId);
      const reserved = job?.estimatedCredits ?? 0;
      if (reserved > 0) {
        console.error(
          'gateway: debit reserve for router settle; no prices for',
          billModel ?? model,
          'response.model=',
          scan.model
        );
        await reconcileCredits({
          requestId,
          actualCredits: reserved,
          provider: 'openrouter',
          model: billModel ?? model,
          promptTokens,
          completionTokens,
        });
        return;
      }
    }

    console.error('gateway: release reserve, no prices for', billModel ?? model);
    await releaseCredits(requestId);
  } catch (err) {
    console.error('gateway: reconcile failed', err);
  }
}
