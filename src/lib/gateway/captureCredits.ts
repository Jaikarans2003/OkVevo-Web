/**
 * Capture wallet write. Uses withTx internally so both App Hosting and the
 * Cloud Run capture job call the same transaction (job is re-read inside it).
 */
import { withTx } from '@/lib/db/tx';
import {
  creditTransactionExists,
  insertCreditTransaction,
  lockBillingByUserId,
  lockJob,
  updateBillingByUserId,
  updateJob,
} from '@/lib/db/wallet';
import { applyCapture, omitUndefined, type JobRecord } from '@/lib/gateway/reserve';

function readInt(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

function jobFromSnap(data: Record<string, unknown> | undefined): JobRecord | undefined {
  if (!data || data.status !== 'settled' || data.provider !== 'fal') return undefined;
  const uid = data.uid;
  const estimated = data.estimatedCredits;
  if (typeof uid !== 'string' || !uid) return undefined;
  if (typeof estimated !== 'number' || !Number.isInteger(estimated) || estimated < 0) {
    return undefined;
  }
  const heldAllocation = readInt(data.heldAllocation);
  const heldTopUp = readInt(data.heldTopUp);
  const hasSplit = data.heldAllocation !== undefined || data.heldTopUp !== undefined;
  return {
    uid,
    provider: 'fal',
    estimatedCredits: estimated,
    status: 'settled',
    heldAllocation: hasSplit ? heldAllocation : estimated,
    heldTopUp: hasSplit ? heldTopUp : 0,
    settledCredits: typeof data.settledCredits === 'number' ? data.settledCredits : undefined,
    captured: data.captured === true,
  };
}

export async function captureCreditsOn(
  opts: { requestId: string; falUsd: number; falCredits: number }
): Promise<{ skipped: boolean; refund: number; overReserve: boolean }> {
  const { requestId, falUsd, falCredits } = opts;
  if (!requestId) return { skipped: true, refund: 0, overReserve: false };

  const txnId = `${requestId}:capture`;
  let out = { skipped: true, refund: 0, overReserve: false };

  await withTx(async (tx) => {
    if (await creditTransactionExists(tx, txnId)) {
      out = { skipped: true, refund: 0, overReserve: false };
      return;
    }
    const jobRow = await lockJob(tx, requestId);
    const job = jobFromSnap(jobRow);
    if (!job) return;
    const billing = await lockBillingByUserId(tx, job.uid);
    const result = applyCapture(
      {
        allocationBalance: Number(billing?.allocationBalance || 0),
        topUpBalance: Number(billing?.topUpBalance || 0),
      },
      job,
      falCredits
    );
    if (result.skipped) {
      out = { skipped: true, refund: 0, overReserve: false };
      return;
    }
    await updateBillingByUserId(tx, job.uid, {
      allocationBalance: result.balances.allocationBalance,
      topUpBalance: result.balances.topUpBalance,
    });
    await updateJob(tx, requestId, {
      captured: true,
      capturedAt: new Date(),
      capturedFalUsd: falUsd,
      settledCredits: result.settledCredits,
      actualCredits: result.settledCredits,
      heldAllocation: result.heldAllocation,
      heldTopUp: result.heldTopUp,
    });
    await insertCreditTransaction(tx, txnId, billing!.id, omitUndefined({
      user_id: job.uid,
      type: 'refund',
      amount: result.refund,
      provider: 'fal',
      request_id: requestId,
    }));
    out = { skipped: false, refund: result.refund, overReserve: result.overReserve };
  });
  return out;
}
