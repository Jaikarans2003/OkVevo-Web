import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebase-admin';
import { clampDebitAmount, creditsFromTokens, lookupModelRates } from '@/lib/gateway/pricing';
import {
  applyReconcile,
  applyRelease,
  applyReserve,
  type GatewayProvider,
  type JobRecord,
} from '@/lib/gateway/reserve';
import { tokenCounts, type UsageScan } from '@/lib/gateway/sse';

function readBalance(data: { creditBalance?: unknown } | undefined): number {
  const n = data?.creditBalance;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
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
  return { uid, provider, estimatedCredits: estimated, status };
}

export class InsufficientCreditsError extends Error {
  readonly code = 'insufficient_quota' as const;
  constructor() {
    super('insufficient credits');
    this.name = 'InsufficientCreditsError';
  }
}

export type GatewayJobFields = {
  uid: string;
  provider: GatewayProvider;
  estimatedCredits: number;
  status: JobRecord['status'];
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
 * Decrement balance and write gatewayJobs/{requestId} as reserved.
 * No creditTransactions row yet.
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
    const result = applyReserve(
      readBalance(userSnap.data()),
      jobFromSnap(jobSnap.data()),
      estimatedCredits,
      uid,
      provider
    );
    if (!result.ok) {
      if (result.reason === 'duplicate') return;
      throw new InsufficientCreditsError();
    }
    tx.set(userRef, { creditBalance: result.balance }, { merge: true });
    tx.set(jobRef, {
      uid,
      provider,
      estimatedCredits: result.job.estimatedCredits,
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
    const result = applyReconcile(readBalance(userSnap.data()), job, actualCredits);
    if (result.skipped) return;

    tx.set(userRef, { creditBalance: result.balance }, { merge: true });
    tx.set(jobRef, { status: 'settled', actualCredits: result.debitAmount }, { merge: true });
    if (result.debitAmount <= 0) return;

    const amount = clampDebitAmount(result.debitAmount, result.debitAmount);
    tx.set(txnRef, {
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
    });
  });
}

/** Restore estimated to balance; no debit. Idempotent. Fal does not bill failures. */
export async function releaseCredits(requestId: string): Promise<void> {
  if (!requestId) return;
  const jobRef = db.collection('gatewayJobs').doc(requestId);

  await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const job = jobFromSnap(jobSnap.data());
    if (!job) return;
    const userRef = db.collection('users').doc(job.uid);
    const userSnap = await tx.get(userRef);
    const result = applyRelease(readBalance(userSnap.data()), job);
    if (result.skipped) return;
    tx.set(userRef, { creditBalance: result.balance }, { merge: true });
    tx.set(jobRef, { status: 'released' }, { merge: true });
  });
}

export async function grantCredits(opts: {
  uid: string;
  amount: number;
  reason: string;
}): Promise<{ balanceBefore: number; balanceAfter: number; requestId: string }> {
  const { uid, reason } = opts;
  const amount = opts.amount;
  if (!uid) throw new Error('uid required');
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('amount must be a positive integer');
  }

  const requestId = `grant-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  const userRef = db.collection('users').doc(uid);
  const txnRef = db.collection('creditTransactions').doc(requestId);

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const balanceBefore = readBalance(userSnap.data());
    const balanceAfter = balanceBefore + amount;
    tx.set(userRef, { creditBalance: balanceAfter }, { merge: true });
    tx.set(txnRef, {
      uid,
      type: 'grant',
      amount,
      requestId,
      reason,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { balanceBefore, balanceAfter, requestId };
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
    const rates = await lookupModelRates(model);
    if (!rates) {
      console.error('gateway: release reserve, no prices for', model);
      await releaseCredits(requestId);
      return;
    }
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
      model,
      promptTokens,
      completionTokens,
      costUsd: billed.costUsd,
      priceUsd: billed.rawUsd,
    });
  } catch (err) {
    console.error('gateway: reconcile failed', err);
  }
}
