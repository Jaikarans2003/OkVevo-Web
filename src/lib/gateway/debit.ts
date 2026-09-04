import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebase-admin';
import { clampDebitAmount, creditsFromTokens, lookupModelRates } from '@/lib/gateway/pricing';
import { tokenCounts, type UsageScan } from '@/lib/gateway/sse';

function readBalance(data: { creditBalance?: unknown } | undefined): number {
  const n = data?.creditBalance;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

export async function debitCredits(opts: {
  uid: string;
  requestId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  credits: number;
  costUsd: number;
  priceUsd: number;
}): Promise<void> {
  const { uid, requestId, model, promptTokens, completionTokens, credits, costUsd, priceUsd } =
    opts;
  if (!uid || !requestId || credits <= 0) return;

  const userRef = db.collection('users').doc(uid);
  const txnRef = db.collection('creditTransactions').doc(requestId);

  await db.runTransaction(async (tx) => {
    const txnSnap = await tx.get(txnRef);
    if (txnSnap.exists) return;

    const userSnap = await tx.get(userRef);
    const balanceBefore = readBalance(userSnap.data());
    // ponytail: no reservation — concurrent streams can overspend. Upgrade: atomic reserve-then-reconcile.
    const amount = clampDebitAmount(credits, balanceBefore);
    if (amount === 0) return;

    const balanceAfter = balanceBefore - amount;
    tx.set(userRef, { creditBalance: balanceAfter }, { merge: true });
    tx.set(txnRef, {
      uid,
      type: 'debit',
      amount,
      model,
      provider: 'openrouter',
      promptTokens,
      completionTokens,
      costUsd,
      priceUsd,
      requestId,
      createdAt: FieldValue.serverTimestamp(),
    });
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

/** After bytes are already sent: price + debit. Failures must not throw to the client. */
export async function settleCompletedChat(opts: {
  uid: string;
  model: string;
  scan: UsageScan;
}): Promise<void> {
  const { uid, model, scan } = opts;
  try {
    if (!scan.id) {
      console.error('gateway: skip debit, missing OpenRouter generation id');
      return;
    }
    const { promptTokens, completionTokens } = tokenCounts(scan.usage);
    const rates = await lookupModelRates(model);
    if (!rates) {
      console.error('gateway: skip debit, no prices for', model);
      return;
    }
    const billed = creditsFromTokens({
      promptTokens,
      completionTokens,
      promptPerToken: rates.promptPerToken,
      completionPerToken: rates.completionPerToken,
    });
    if (billed.credits === 0) return;
    await debitCredits({
      uid,
      requestId: scan.id,
      model,
      promptTokens,
      completionTokens,
      credits: billed.credits,
      costUsd: billed.costUsd,
      priceUsd: billed.rawUsd,
    });
  } catch (err) {
    console.error('gateway: debit failed', err);
  }
}
