/**
 * Capture wallet write. Uses withTx internally so both App Hosting and the
 * Cloud Run capture job call the same transaction (job is re-read inside it).
 */
import { withTx } from '@/lib/db/tx';
import {
  creditTransactionExists,
  insertCreditTransaction,
  lockBillingById,
  lockJob,
  updateBillingById,
  updateJob,
  type BillingAccountData,
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
  const heldSponsored = readInt(data.heldSponsored);
  const hasSplit =
    data.heldAllocation !== undefined ||
    data.heldTopUp !== undefined ||
    data.heldSponsored !== undefined;
  return {
    uid,
    provider: 'fal',
    estimatedCredits: estimated,
    status: 'settled',
    heldAllocation: hasSplit ? heldAllocation : estimated,
    heldTopUp: hasSplit ? heldTopUp : 0,
    ...(hasSplit && heldSponsored !== 0 ? { heldSponsored } : {}),
    settledCredits: typeof data.settledCredits === 'number' ? data.settledCredits : undefined,
    captured: data.captured === true,
  };
}

async function lockBillingForJob(
  tx: Parameters<Parameters<typeof withTx>[0]>[0],
  jobRow: Record<string, unknown> | undefined
): Promise<BillingAccountData | undefined> {
  const billingAccountId =
    typeof jobRow?.billingAccountId === 'string' ? jobRow.billingAccountId : null;
  if (!billingAccountId) return undefined;
  return lockBillingById(tx, billingAccountId);
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
    const billing = await lockBillingForJob(tx, jobRow);
    if (!billing) return;
    const result = applyCapture(
      {
        allocationBalance: Number(billing.allocationBalance || 0),
        topUpBalance: Number(billing.topUpBalance || 0),
      },
      job,
      falCredits
    );
    if (result.skipped) {
      out = { skipped: true, refund: 0, overReserve: false };
      return;
    }
    await updateBillingById(tx, billing.id, {
      allocationBalance: result.balances.allocationBalance,
      topUpBalance: result.balances.topUpBalance,
      ...(result.balances.sponsoredBalance !== undefined
        ? { sponsoredBalance: result.balances.sponsoredBalance }
        : {}),
    });
    await updateJob(tx, requestId, {
      captured: true,
      capturedAt: new Date(),
      capturedFalUsd: falUsd,
      settledCredits: result.settledCredits,
      actualCredits: result.settledCredits,
      heldAllocation: result.heldAllocation,
      heldTopUp: result.heldTopUp,
      ...(result.heldSponsored ? { heldSponsored: result.heldSponsored } : {}),
    });
    await insertCreditTransaction(tx, txnId, billing.id, omitUndefined({
      user_id: job.uid,
      org_id: typeof jobRow?.orgId === 'string' ? jobRow.orgId : null,
      super_org_id: typeof jobRow?.superOrgId === 'string' ? jobRow.superOrgId : null,
      end_customer_ref:
        typeof jobRow?.endCustomerRef === 'string' ? jobRow.endCustomerRef : null,
      type: 'refund',
      amount: result.refund,
      provider: 'fal',
      request_id: requestId,
      requested_model: typeof jobRow?.requestedModel === 'string' ? jobRow.requestedModel : undefined,
    }));
    out = { skipped: false, refund: result.refund, overReserve: result.overReserve };
  });
  return out;
}
