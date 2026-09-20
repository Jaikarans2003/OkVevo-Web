import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebase-admin';
import { nextAllocationGrantedTotal, nextTopUpPurchasedTotal } from '@/types/credits';
import { clampDebitAmount, creditsFromTokens, hasPositiveRates, isRouterAliasModel, lookupModelRates, settleBillModel } from '@/lib/gateway/pricing';
import {
  applyReconcile,
  applyRelease,
  applyReserve,
  type BucketBalances,
  type GatewayProvider,
  type JobRecord,
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

function jobFromSnap(data: FirebaseFirestore.DocumentData | undefined): JobRecord | undefined {
  if (!data) return undefined;
  const status = data.status;
  const provider = data.provider;
  const estimated = data.estimatedCredits;
  const uid = data.uid;
  if (status !== 'reserved' && status !== 'settled' && status !== 'released') return undefined;
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

  await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const userSnap = await tx.get(userRef);
    const data = userSnap.data();
    if (readPlanStatus(data) !== 'active') {
      throw new PlanNotActiveError();
    }
    const result = applyReserve(
      readBalances(data),
      jobFromSnap(jobSnap.data()),
      estimatedCredits,
      uid,
      provider
    );
    if (!result.ok) {
      if (result.reason === 'duplicate') return;
      throw new InsufficientCreditsError();
    }
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
): Promise<(GatewayJobFields & { id: string }) | null> {
  const snap = await db.collection('gatewayJobs').doc(requestId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
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
    falStatusUrl: typeof data.falStatusUrl === 'string' ? data.falStatusUrl : undefined,
    falResponseUrl: typeof data.falResponseUrl === 'string' ? data.falResponseUrl : undefined,
    falCancelUrl: typeof data.falCancelUrl === 'string' ? data.falCancelUrl : undefined,
    holdId: typeof data.holdId === 'string' ? data.holdId : undefined,
    payload: data.payload,
  };
}

export async function patchGatewayJob(
  requestId: string,
  patch: Record<string, unknown>
): Promise<void> {
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

    const userRef = db.collection('users').doc(job.uid);
    const userSnap = await tx.get(userRef);
    const data = userSnap.data();
    if (readPlanStatus(data) !== 'active') {
      // Still settle the hold split back if plan lapsed mid-flight — release path preferred.
      // Plan: reconcile requires active; release unused instead.
      const released = applyRelease(readBalances(data), job);
      if (!released.skipped) {
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
        actualCredits: result.debitAmount,
        heldAllocation: result.heldAllocation,
        heldTopUp: result.heldTopUp,
      },
      { merge: true }
    );
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

/** Restore held split to buckets; no debit. Idempotent. Fal does not bill failures. */
export async function releaseCredits(requestId: string): Promise<void> {
  if (!requestId) return;
  const jobRef = db.collection('gatewayJobs').doc(requestId);

  await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const job = jobFromSnap(jobSnap.data());
    if (!job) return;
    const userRef = db.collection('users').doc(job.uid);
    const userSnap = await tx.get(userRef);
    const result = applyRelease(readBalances(userSnap.data()), job);
    if (result.skipped) return;
    tx.set(
      userRef,
      {
        allocationBalance: result.balances.allocationBalance,
        topUpBalance: result.balances.topUpBalance,
      },
      { merge: true }
    );
    tx.set(jobRef, { status: 'released' }, { merge: true });
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
