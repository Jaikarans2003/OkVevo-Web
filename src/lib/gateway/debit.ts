import { createHash } from 'node:crypto';

import { sql } from '@/lib/db/client';
import { withTx, type TxSql } from '@/lib/db/tx';
import {
  type BillingAccountData,
  type DbHandle,
  creditTransactionExists,
  ensureUserAndBilling,
  getBillingByOrgId,
  getBillingByUserId,
  getJob,
  insertCreditTransaction,
  insertJob,
  lockBillingById,
  lockBillingByUserId,
  lockJob,
  updateBillingById,
  updateBillingByUserId,
  updateJob,
} from '@/lib/db/wallet';
import { decideIdempotency, type IdemRow } from '@/lib/fal/idempotency';
import { canTransition } from '@/lib/fal/jobMachine';

import { applySpendClose, applySpendRelease, type SpendDaily } from '@/lib/fal/dramaSwitches';
import { refreshAllocationIfDue } from '@/lib/billing/allocation';
import {
  loadAllocationLots,
  remainingForSubscription,
  remainingByLot,
  takeFromLots,
} from '@/lib/billing/allocationLots';
import { isEntitled } from '@/lib/billing/entitlement';
import { writeAuditLog } from '@/lib/orgs/auditLog';
import { admit, parseQueue, QueueFullError, slotsForPlan } from '@/lib/fal/falQueue';
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
import { computeCreditLimit } from '@/lib/orgs/creditLimit';
import { resolvePayingWallet } from '@/lib/orgs/orgContext';
import { tokenCounts, type UsageScan } from '@/lib/gateway/sse';

function readInt(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

/** top_up stays >= 0 (2b-a); keep signed reader for legacy rows pre-migrate. */
function readTopUp(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) ? n : 0;
}

/** Sponsored may be negative on prepaid children. */
function readSponsored(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) ? n : 0;
}

/**
 * Read buckets. One-time migrate: legacy creditBalance → topUpBalance
 * when both new buckets are absent/zero and creditBalance > 0.
 * sponsoredBalance omitted when unset/0 so pre-2b-a selfchecks stay identical.
 */
export function readBalances(data: Record<string, unknown> | undefined): BucketBalances {
  if (!data) return { allocationBalance: 0, topUpBalance: 0 };
  const allocation = readInt(data.allocationBalance);
  let topUp = readTopUp(data.topUpBalance);
  const legacy = readInt(data.creditBalance);
  // Migrate only when new fields were never seeded (both 0) and legacy remains.
  if (allocation === 0 && topUp === 0 && legacy > 0 && data.topUpBalance === undefined) {
    topUp = legacy;
  }
  const out: BucketBalances = { allocationBalance: allocation, topUpBalance: topUp };
  if (data.sponsoredBalance !== undefined && data.sponsoredBalance !== 0) {
    out.sponsoredBalance = readSponsored(data.sponsoredBalance);
  }
  return out;
}

/** Persist bucket balances; only write sponsored when the pure path set it. */
function billingBalancePatch(balances: BucketBalances): Record<string, number> {
  const patch: Record<string, number> = {
    allocationBalance: balances.allocationBalance,
    topUpBalance: balances.topUpBalance,
  };
  if (balances.sponsoredBalance !== undefined) {
    patch.sponsoredBalance = balances.sponsoredBalance;
  }
  return patch;
}

function readPlanStatus(data: Record<string, unknown> | undefined): string | null {
  const s = data?.planStatus;
  return typeof s === 'string' ? s : null;
}

export function jobFromSnap(data: Record<string, unknown> | undefined): JobRecord | undefined {
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
  const heldSponsored = readInt(data.heldSponsored);
  // Legacy jobs without hold split: treat entire hold as allocation
  const hasSplit =
    data.heldAllocation !== undefined ||
    data.heldTopUp !== undefined ||
    data.heldSponsored !== undefined;
  return {
    uid,
    provider,
    estimatedCredits: estimated,
    status,
    heldAllocation: hasSplit ? heldAllocation : estimated,
    heldTopUp: hasSplit ? heldTopUp : 0,
    ...(hasSplit && heldSponsored !== 0 ? { heldSponsored } : {}),
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

export class OrgAccessDeniedError extends Error {
  readonly code: 'org_access_denied' | 'org_not_found';
  constructor(code: 'org_access_denied' | 'org_not_found' = 'org_access_denied') {
    super(code);
    this.name = 'OrgAccessDeniedError';
    this.code = code;
  }
}

/** Child orgs use the super-org's plan slots (§5.4); prepaid always admits. */
async function slotsForPayingWallet(
  tx: TxSql,
  billing: BillingAccountData
): Promise<ReturnType<typeof slotsForPlan>> {
  if (billing.accessMode === 'prepaid' && billing.ownerOrgId) {
    const parentRows = await tx`
      select parent_id from organizations where id = ${billing.ownerOrgId}
    `;
    const parentId = parentRows[0]?.parent_id as string | undefined;
    if (parentId) {
      const parentBilling = await getBillingByOrgId(tx, parentId);
      return slotsForPlan(parentBilling?.plan, 'active');
    }
    return slotsForPlan(billing.plan, 'active');
  }
  return slotsForPlan(billing.plan, readPlanStatus(billing));
}

/** Lock the wallet stamped on the job — never re-resolve by job.uid (§5.1). */
async function lockBillingForJob(
  tx: TxSql,
  jobRow: Record<string, unknown> | undefined
): Promise<BillingAccountData | undefined> {
  const billingAccountId =
    typeof jobRow?.billingAccountId === 'string' ? jobRow.billingAccountId : null;
  if (!billingAccountId) return undefined;
  return lockBillingById(tx, billingAccountId);
}

/**
 * Open holds for this user, read inside the reserve transaction after the
 * billing_accounts lock so parallel chats cannot both pass a slot/budget check.
 * Null when the query cannot run: callers then keep today's 402.
 */
async function listOpenHolds(
  tx: TxSql,
  uid: string
): Promise<{ held: number; openChat: number } | null> {
  try {
    const rows = await tx`
      select provider, status, held_allocation, held_top_up, estimated_credits
      from gateway_jobs
      where user_id = ${uid} and status in ${tx(Array.from(RELEASABLE))}
    `;
    return summarizeOpenHolds(
      rows.map((r) => ({
        provider: r.provider,
        status: r.status,
        heldAllocation: r.held_allocation,
        heldTopUp: r.held_top_up,
        estimatedCredits: r.estimated_credits,
      }))
    );
  } catch (err) {
    console.error('gateway: open hold query failed', err);
    return null;
  }
}

type SpendHold = {
  spendDay: string;
  reservedFalUsd: number;
};

/** Read-only parse of the reserve-time spend hold request. No DB read needed: the write is a plain increment. */
function readSpendForHold(extra: Record<string, unknown> | undefined): SpendHold | null {
  const reservedFalUsd = Number(extra?.reservedFalUsd ?? 0);
  const spendDay = typeof extra?.spendDay === 'string' ? extra.spendDay : '';
  if (!(reservedFalUsd > 0) || !spendDay) return null;
  return { spendDay, reservedFalUsd };
}

async function applySpendHold(tx: TxSql, spend: SpendHold | null): Promise<void> {
  if (!spend) return;
  await tx`
    insert into spend_daily (day, fal_usd_held) values (${spend.spendDay}, ${spend.reservedFalUsd})
    on conflict (day) do update set fal_usd_held = spend_daily.fal_usd_held + ${spend.reservedFalUsd}
  `;
}

function spendRowToData(row: Record<string, unknown> | undefined): SpendDaily | undefined {
  if (!row) return undefined;
  return {
    falUsd: Number(row.fal_usd ?? 0),
    falUsdHeld: Number(row.fal_usd_held ?? 0),
    creditsCharged: Number(row.credits_charged ?? 0),
    jobs: Number(row.jobs ?? 0),
  };
}

/** Create-if-missing + lock spend_daily for `day`. Mirrors Firestore's tx.get on a doc that may not exist yet. */
async function lockSpendDaily(tx: TxSql, day: string): Promise<SpendDaily | undefined> {
  await tx`insert into spend_daily (day) values (${day}) on conflict (day) do nothing`;
  const rows = await tx`select * from spend_daily where day = ${day} for update`;
  return spendRowToData(rows[0] as Record<string, unknown> | undefined);
}

type SpendReleaseRead = {
  spendDay: string;
  current: SpendDaily | undefined;
  reservedFalUsd: number;
};

/** Read spend_daily (locked) before any write in the same reserve transaction. */
export async function loadSpendRelease(
  tx: TxSql,
  data: Record<string, unknown> | undefined
): Promise<SpendReleaseRead | null> {
  const reservedFalUsd = Number(data?.reservedFalUsd ?? 0);
  const spendDay = typeof data?.spendDay === 'string' ? data.spendDay : '';
  if (!(reservedFalUsd > 0) || !spendDay) return null;
  const current = await lockSpendDaily(tx, spendDay);
  return { spendDay, current, reservedFalUsd };
}

export function writeSpendRelease(tx: TxSql, spend: SpendReleaseRead | null): void {
  if (!spend) return;
  const patch = applySpendRelease(spend.current, spend.reservedFalUsd);
  void tx`update spend_daily set fal_usd_held = ${patch.falUsdHeld} where day = ${spend.spendDay}`;
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

/** Chat/Tavily reserved-hold TTL (plan: > chat maxDuration 800s). Fal uses its own sweeps. */
export const CHAT_HOLD_TTL_MS = 15 * 60 * 1000;

/**
 * Decrement buckets (FIFO) and write gateway_jobs/{requestId} as reserved.
 * Spend gate: entitled (active + before currentPeriodEnd). No grace.
 */
export async function reserveCredits(opts: {
  uid: string;
  requestId: string;
  provider: GatewayProvider;
  estimatedCredits: number;
  extra?: Record<string, unknown>;
  orgPublicId?: string | null;
  endCustomerRef?: string | null;
  email?: string | null;
  emailVerified?: boolean;
}): Promise<void> {
  const { uid, requestId, provider, estimatedCredits, extra } = opts;
  if (!uid || !requestId) throw new Error('uid and requestId required');

  await withTx(async (tx) => {
    const spend = readSpendForHold(extra);
    const paying = await resolvePayingWallet(tx, {
      userId: uid,
      orgPublicId: opts.orgPublicId,
      endCustomerRef: opts.endCustomerRef,
      email: opts.email,
      emailVerified: opts.emailVerified,
    });
    if (!paying.ok) throw new OrgAccessDeniedError(paying.code);
    const billing = await lockBillingById(tx, paying.billingAccountId);
    if (!billing) throw new OrgAccessDeniedError('org_access_denied');
    const holds = await listOpenHolds(tx, uid);
    const jobRow = await lockJob(tx, requestId);
    // ponytail: creditLimit recompute per reserve; cache on wallet if hot.
    const creditLimit = await computeCreditLimit(tx, billing.id);
    if (billing.accessMode !== 'prepaid' && !isEntitled(billing)) {
      throw new PlanNotActiveError();
    }
    if (provider === 'openrouter' && holds) {
      const plan = await slotsForPayingWallet(tx, billing);
      if (plan.admit && chatConcurrencyBlocked(holds.openChat, plan.slots)) {
        throw new PlanConcurrencyError();
      }
    }
    const balances = readBalances(billing);
    const result = applyReserve(
      balances,
      jobFromSnap(jobRow),
      estimatedCredits,
      uid,
      provider,
      creditLimit
    );
    if (!result.ok) {
      if (result.reason === 'duplicate') return;
      if (
        holds &&
        denialForFailedReserve({
          spendable:
            balances.allocationBalance +
            balances.topUpBalance +
            (balances.sponsoredBalance ?? 0) +
            creditLimit,
          estimated: estimatedCredits,
          inFlightHeld: holds.held,
        }) === 'in_flight_budget_exhausted'
      ) {
        throw new InFlightBudgetError();
      }
      throw new InsufficientCreditsError();
    }
    await applySpendHold(tx, spend);
    await updateBillingById(tx, billing.id, billingBalancePatch(result.balances));
    const holdExpiresAt =
      provider === 'openrouter' || provider === 'tavily'
        ? new Date(Date.now() + CHAT_HOLD_TTL_MS)
        : undefined;
    await insertJob(tx, requestId, uid, billing.id, {
      uid,
      orgId: paying.orgId,
      superOrgId: paying.superOrgId,
      endCustomerRef: paying.endCustomerRef,
      provider,
      estimatedCredits: result.job.estimatedCredits,
      heldAllocation: result.job.heldAllocation,
      heldTopUp: result.job.heldTopUp,
      ...(result.job.heldSponsored ? { heldSponsored: result.job.heldSponsored } : {}),
      status: 'reserved',
      ...(holdExpiresAt ? { holdExpiresAt } : {}),
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

function idemRowToData(row: Record<string, unknown> | undefined): IdemRow | undefined {
  if (!row) return undefined;
  return {
    uid: String(row.user_id),
    runId: String(row.run_id),
    bodyHash: String(row.body_hash ?? ''),
    phase: row.phase as IdemRow['phase'],
    submitStarted: row.submit_started === true,
    holdId: String(row.hold_id ?? ''),
    falRequestId: (row.fal_request_id as string) || undefined,
  };
}

export async function getIdemRow(db: DbHandle, id: string): Promise<IdemRow | undefined> {
  const rows = await db`select * from fal_run_idempotency where id = ${id}`;
  return idemRowToData(rows[0] as Record<string, unknown> | undefined);
}

export async function lockIdemRow(tx: TxSql, id: string): Promise<IdemRow | undefined> {
  const rows = await tx`select * from fal_run_idempotency where id = ${id} for update`;
  return idemRowToData(rows[0] as Record<string, unknown> | undefined);
}

export async function insertIdemRow(
  tx: TxSql,
  id: string,
  row: { uid: string; runId: string; bodyHash: string; phase: string; submitStarted: boolean; holdId: string }
): Promise<void> {
  await tx`
    insert into fal_run_idempotency ${tx({
      id,
      user_id: row.uid,
      run_id: row.runId,
      body_hash: row.bodyHash,
      phase: row.phase,
      submit_started: row.submitStarted,
      hold_id: row.holdId,
    })}
  `;
}

export async function updateIdemRow(tx: TxSql, id: string, patch: Record<string, unknown>): Promise<void> {
  const row: Record<string, unknown> = {};
  if ('phase' in patch) row.phase = patch.phase;
  if ('submitStarted' in patch) row.submit_started = patch.submitStarted;
  if ('falRequestId' in patch) row.fal_request_id = patch.falRequestId;
  if (Object.keys(row).length === 0) return;
  await tx`update fal_run_idempotency set ${tx(row)}, updated_at = now() where id = ${id}`;
}

export async function lockQueue(
  tx: TxSql,
  uid: string
): Promise<{ running: unknown; queued: unknown; needsSubmit: boolean } | undefined> {
  const rows = await tx`select * from fal_queues where user_id = ${uid} for update`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return { running: row.running, queued: row.queued, needsSubmit: row.needs_submit === true };
}

export async function getQueue(
  db: DbHandle,
  uid: string
): Promise<{ running: unknown; queued: unknown; needsSubmit: boolean } | undefined> {
  const rows = await db`select * from fal_queues where user_id = ${uid}`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return { running: row.running, queued: row.queued, needsSubmit: row.needs_submit === true };
}

export async function upsertQueue(
  tx: TxSql,
  uid: string,
  patch: { running: string[]; queued: string[]; queuedCount: number; needsSubmit: boolean }
): Promise<void> {
  await tx`
    insert into fal_queues ${tx({
      user_id: uid,
      running: patch.running,
      queued: patch.queued,
      queued_count: patch.queuedCount,
      needs_submit: patch.needsSubmit,
    })}
    on conflict (user_id) do update set
      running = excluded.running,
      queued = excluded.queued,
      queued_count = excluded.queued_count,
      needs_submit = excluded.needs_submit,
      updated_at = now()
  `;
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
  const existing = await getIdemRow(sql, falRunDocId(uid, runId));
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
  orgPublicId?: string | null;
  endCustomerRef?: string | null;
  email?: string | null;
  emailVerified?: boolean;
}): Promise<{
  kind: 'created' | 'continue' | 'replay' | 'unknown';
  holdId: string;
  falRequestId?: string;
  placement?: 'running' | 'queued';
  position?: number;
  slotsInUse?: number;
  slotsLimit?: number;
}> {
  const idemId = falRunDocId(opts.uid, opts.runId);
  return withTx(async (tx) => {
    const spend = readSpendForHold(opts.extra);
    const existing = await lockIdemRow(tx, idemId);
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
    const paying = await resolvePayingWallet(tx, {
      userId: opts.uid,
      orgPublicId: opts.orgPublicId,
      endCustomerRef: opts.endCustomerRef,
      email: opts.email,
      emailVerified: opts.emailVerified,
    });
    if (!paying.ok) throw new OrgAccessDeniedError(paying.code);
    const billing = await lockBillingById(tx, paying.billingAccountId);
    if (!billing) throw new OrgAccessDeniedError('org_access_denied');
    const jobRow = await lockJob(tx, holdId);
    const queue = await lockQueue(tx, opts.uid);
    // ponytail: creditLimit recompute per reserve; cache on wallet if hot.
    const creditLimit = await computeCreditLimit(tx, billing.id);
    if (billing.accessMode !== 'prepaid' && !isEntitled(billing)) {
      throw new PlanNotActiveError();
    }
    const plan = await slotsForPayingWallet(tx, billing);
    if (!plan.admit) throw new PlanNotActiveError();
    const admitted = admit(parseQueue(queue), holdId, plan.slots);
    if (!admitted.ok) throw new QueueFullError();
    const result = applyReserve(
      readBalances(billing),
      jobFromSnap(jobRow),
      opts.estimatedCredits,
      opts.uid,
      'fal',
      creditLimit
    );
    if (!result.ok) {
      if (result.reason === 'duplicate') throw new IdempotencyConflictError();
      throw new InsufficientCreditsError();
    }
    await applySpendHold(tx, spend);
    await updateBillingById(tx, billing.id, billingBalancePatch(result.balances));
    await upsertQueue(tx, opts.uid, {
      running: admitted.state.running,
      queued: admitted.state.queued,
      queuedCount: admitted.state.queued.length,
      needsSubmit: admitted.placement === 'running' || queue?.needsSubmit === true,
    });
    await insertJob(tx, holdId, opts.uid, billing.id, {
      uid: opts.uid,
      orgId: paying.orgId,
      superOrgId: paying.superOrgId,
      endCustomerRef: paying.endCustomerRef,
      provider: 'fal',
      estimatedCredits: result.job.estimatedCredits,
      heldAllocation: result.job.heldAllocation,
      heldTopUp: result.job.heldTopUp,
      ...(result.job.heldSponsored ? { heldSponsored: result.job.heldSponsored } : {}),
      status: 'queued',
      queuePosition: admitted.position,
      ...(opts.extra ?? {}),
    });
    await insertIdemRow(tx, idemId, {
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
  const idemId = falRunDocId(uid, runId);
  return withTx(async (tx) => {
    const row = await lockIdemRow(tx, idemId);
    const job = await lockJob(tx, holdId);
    if (job?.status !== 'dispatching') return 'busy';
    if (!row || row.submitStarted === true) return 'busy';
    if (job?.cancelRequested === true) return 'cancelled';
    await updateIdemRow(tx, idemId, { submitStarted: true, phase: 'dispatching' });
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
  return withTx(async (tx) => {
    const job = await lockJob(tx, requestId);
    const status = job?.status;
    if (typeof status !== 'string' || !from.includes(status as JobStatus)) return false;
    if (!canTransition(status, to)) return false;
    const idemId = idem ? falRunDocId(idem.uid, idem.runId) : null;
    const idemRow = idemId ? await lockIdemRow(tx, idemId) : null;
    await updateJob(tx, requestId, { status: to, ...patch });
    if (idem && idemRow && idemId) {
      await updateIdemRow(tx, idemId, idem.patch);
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
  const idemId = falRunDocId(opts.uid, opts.runId);
  return withTx(async (tx) => {
    const job = await lockJob(tx, opts.holdId);
    const status = job?.status;
    if (status !== 'dispatching' || !canTransition('dispatching', 'submitted')) {
      return { ok: false, cancelRequested: false };
    }
    const cancelRequested = job?.cancelRequested === true;
    if (opts.falRequestId !== opts.holdId) {
      const aliasRow = await lockJob(tx, opts.falRequestId);
      if (!aliasRow) {
        const billing = await getBillingByUserId(tx, opts.uid);
        if (billing) {
          await insertJob(tx, opts.falRequestId, opts.uid, billing.id, { aliasOf: opts.holdId });
        }
      }
    }
    await updateJob(tx, opts.holdId, {
      status: 'submitted',
      falRequestId: opts.falRequestId,
      falStatusUrl: opts.falStatusUrl,
      falResponseUrl: opts.falResponseUrl,
      falCancelUrl: opts.falCancelUrl,
    });
    await updateIdemRow(tx, idemId, { phase: 'submitted', falRequestId: opts.falRequestId, submitStarted: true });
    return { ok: true, cancelRequested };
  });
}

export async function markFalRun(
  uid: string,
  runId: string,
  patch: { phase: 'submitted' | 'unknown' | 'released'; falRequestId?: string }
): Promise<void> {
  const idemId = falRunDocId(uid, runId);
  await sql`
    insert into fal_run_idempotency ${sql({
      id: idemId,
      user_id: uid,
      run_id: runId,
      phase: patch.phase,
      fal_request_id: patch.falRequestId ?? null,
    })}
    on conflict (id) do update set
      phase = excluded.phase,
      fal_request_id = coalesce(excluded.fal_request_id, fal_run_idempotency.fal_request_id),
      updated_at = now()
  `;
}

/** Move a reserved hold to Fal's request_id so webhook lookup is gateway_jobs/{falId}. */
export async function rebindGatewayJob(fromId: string, toId: string): Promise<void> {
  if (!fromId || !toId || fromId === toId) return;

  await withTx(async (tx) => {
    const fromRows = await tx`select * from gateway_jobs where id = ${fromId} for update`;
    const fromRow = fromRows[0] as Record<string, unknown> | undefined;
    if (!fromRow) return;
    const toRows = await tx`select 1 from gateway_jobs where id = ${toId} for update`;
    if (toRows.length > 0) {
      await tx`delete from gateway_jobs where id = ${fromId}`;
      return;
    }
    const { id: _fromRowId, created_at: _createdAt, updated_at: _updatedAt, ...rest } = fromRow;
    await tx`
      insert into gateway_jobs ${tx({
        ...rest,
        id: toId,
        hold_id: fromId,
        request_id: toId,
        created_at: fromRow.created_at as Date,
      })}
    `;
    await tx`delete from gateway_jobs where id = ${fromId}`;
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
  clientCode?: string;
  vendorStatus?: number;
  cancelRequested?: boolean;
  submitAttempts?: number;
  firstRejectAtMs?: number | null;
  nextAttemptAtMs?: number | null;
}) | null> {
  const data = await getJob(sql, requestId);
  if (!data) return null;
  if (typeof data.aliasOf === 'string' && data.aliasOf && data.aliasOf !== requestId) {
    return readGatewayJob(data.aliasOf);
  }
  const job = jobFromSnap(data);
  if (!job) return null;
  return {
    id: requestId,
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
    clientCode: typeof data.clientCode === 'string' ? data.clientCode : undefined,
    vendorStatus: typeof data.vendorStatus === 'number' ? data.vendorStatus : undefined,
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
  await updateJob(sql, requestId, patch);
}

/**
 * Write one debit for actual credits; refund unused reserve or extra-decrement.
 * Idempotent on credit_transactions/{requestId}.
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

  await withTx(async (tx) => {
    if (await creditTransactionExists(tx, requestId)) return;

    const jobRow = await lockJob(tx, requestId);
    const job = jobFromSnap(jobRow);
    if (!job) return;
    const jobData = jobRow;
    const spendDay = typeof jobData?.spendDay === 'string' ? jobData.spendDay : '';
    const reservedFalUsd = Number(jobData?.reservedFalUsd ?? 0);
    // Gate is spendDay truthy only — unlike loadSpendRelease, reconcile always
    // touches the day row (even reservedFalUsd 0) to match the Firestore original.
    const spendCurrent = spendDay ? await lockSpendDaily(tx, spendDay) : undefined;

    const billing = await lockBillingForJob(tx, jobData);
    if (!billing) return;
    // Limits are checked only at reserve. Admitted work is always charged (§5.1),
    // even if the plan lapsed mid-call. creditLimit still floors prepaid settle.
    const creditLimit = await computeCreditLimit(tx, billing.id);
    const result = applyReconcile(readBalances(billing), job, actualCredits, creditLimit);
    if (result.skipped) return;

    await updateBillingById(tx, billing.id, billingBalancePatch(result.balances));
    await updateJob(tx, requestId, {
      status: 'settled',
      captured: false,
      actualCredits: result.debitAmount,
      heldAllocation: result.heldAllocation,
      heldTopUp: result.heldTopUp,
      ...(result.heldSponsored ? { heldSponsored: result.heldSponsored } : {}),
    });
    if (spendDay) {
      const closed = applySpendClose(spendCurrent, {
        reservedFalUsd,
        settledRawUsd: opts.priceUsd ?? 0,
        actualCredits: result.debitAmount,
      });
      await tx`
        update spend_daily set
          fal_usd = ${closed.falUsd},
          fal_usd_held = ${closed.falUsdHeld},
          credits_charged = ${closed.creditsCharged},
          jobs = ${closed.jobs}
        where day = ${spendDay}
      `;
    }

    if (result.debitAmount <= 0) return;

    const common = omitUndefined({
      user_id: job.uid,
      org_id: typeof jobData?.orgId === 'string' ? jobData.orgId : null,
      super_org_id: typeof jobData?.superOrgId === 'string' ? jobData.superOrgId : null,
      end_customer_ref:
        typeof jobData?.endCustomerRef === 'string' ? jobData.endCustomerRef : null,
      absorbed: result.absorbed,
      provider,
      model: opts.model,
      requested_model: typeof jobData?.requestedModel === 'string' ? jobData.requestedModel : undefined,
      prompt_tokens: opts.promptTokens,
      completion_tokens: opts.completionTokens,
      cost_usd: opts.costUsd,
      price_usd: opts.priceUsd,
      request_id: requestId,
    });

    // Bucketed debits (null bucket historically counted as allocation — split for 2b-a).
    if (result.heldAllocation > 0) {
      const lots = await loadAllocationLots(tx, billing.id);
      const restoredAlloc = billing.allocationBalance + job.heldAllocation;
      const rem = remainingByLot(lots, restoredAlloc);
      const slices = takeFromLots(rem, result.heldAllocation);
      if (slices.length === 0) {
        await insertCreditTransaction(tx, requestId, billing.id, {
          ...common,
          type: 'debit',
          amount: result.heldAllocation,
          bucket: 'allocation',
        });
      } else {
        let i = 0;
        for (const slice of slices) {
          i += 1;
          const id = i === 1 ? requestId : `${requestId}:alloc:${i}`;
          await insertCreditTransaction(tx, id, billing.id, {
            ...common,
            type: 'debit',
            amount: slice.amount,
            bucket: 'allocation',
            razorpay_subscription_id: slice.subscriptionId,
          });
        }
      }
    }
    if (result.heldTopUp > 0) {
      await insertCreditTransaction(tx, `${requestId}:top_up`, billing.id, {
        ...common,
        type: 'debit',
        amount: result.heldTopUp,
        bucket: 'top_up',
      });
    }
    if (result.heldSponsored > 0) {
      await insertCreditTransaction(tx, `${requestId}:sponsored`, billing.id, {
        ...common,
        type: 'debit',
        amount: result.heldSponsored,
        bucket: 'sponsored',
      });
    }
    // Legacy path: wallet debit with no hold split recorded.
    if (
      result.heldAllocation === 0 &&
      result.heldTopUp === 0 &&
      result.heldSponsored === 0 &&
      result.walletDebit > 0
    ) {
      const amount = clampDebitAmount(result.walletDebit, result.walletDebit);
      await insertCreditTransaction(tx, requestId, billing.id, {
        ...common,
        type: 'debit',
        amount,
        bucket: 'allocation',
      });
    }
  });
}

/**
 * Capture pass: Fal billing-events cost_total → min(credits, reserve).
 * Refunds via the same wallet CAS as collect. Idempotent on captured=true
 * and credit_transactions/{requestId}:capture.
 */
export async function captureCredits(opts: {
  requestId: string;
  falUsd: number;
  falCredits: number;
}): Promise<{ skipped: boolean; refund: number; overReserve: boolean }> {
  return captureCreditsOn(opts);
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

  return withTx(async (tx) => {
    const jobRow = await lockJob(tx, requestId);
    const job = jobFromSnap(jobRow);
    if (!job || !from.includes(job.status)) return false;
    if (job.provider === 'fal' && !canTransition(job.status, 'released')) return false;
    let unsentIdemId: string | null = null;
    if (opts?.unsent && job.status === 'dispatching') {
      const runId = String(jobRow?.runId ?? '');
      if (!runId) return false;
      const idemId = falRunDocId(job.uid, runId);
      const idemRow = await lockIdemRow(tx, idemId);
      if (idemRow?.submitStarted === true) return false;
      unsentIdemId = idemId;
    }
    const billing = await lockBillingForJob(tx, jobRow);
    if (!billing) return false;
    const spend = await loadSpendRelease(tx, jobRow);
    const result = applyRelease(readBalances(billing), job);
    if (result.skipped) return false;
    writeSpendRelease(tx, spend);
    await updateBillingById(tx, billing.id, billingBalancePatch(result.balances));
    await updateJob(tx, requestId, { status: 'released', ...(opts?.patch ?? {}) });
    if (unsentIdemId) await updateIdemRow(tx, unsentIdemId, { phase: 'released', submitStarted: true });
    return true;
  });
}

export type GrantBucket = 'allocation' | 'topUp';

/**
 * allocation grants SET (default) or ADD (`mode: 'add'`); topUp grants ADD.
 * Allocation SET with razorpaySubscriptionId replaces only that subscription's lot.
 * Idempotent when requestId is provided (credit_transactions/{requestId}).
 */
export async function grantCredits(opts: {
  /** Individual wallet owner. Required unless `billingAccountId` is set (org wallets). */
  uid?: string;
  /** Org / upgraded wallet id. When set, skips ensureUserAndBilling + owner_user_id lock. */
  billingAccountId?: string;
  amount: number;
  reason: string;
  bucket: GrantBucket;
  requestId?: string;
  /** Extra user-doc fields to merge (plan metadata, nextAllocationDate, etc.). */
  userPatch?: Record<string, unknown>;
  /** allocation only. `set` (default) replaces the bucket; `add` is an upgrade delta. */
  mode?: 'set' | 'add';
  /** Allocation lot stamp (Razorpay subscription id). */
  razorpaySubscriptionId?: string | null;
  /** Allocation lot expiry (= subscription current_period_end). */
  expiresAt?: Date | null;
  /** Written in this transaction only when the wallet belongs to an org. */
  planAudit?: { action: string; metadata?: Record<string, unknown> };
}): Promise<{ allocationBalance: number; topUpBalance: number; requestId: string }> {
  const { reason, bucket, userPatch } = opts;
  const uid = opts.uid;
  const billingAccountId = opts.billingAccountId;
  const mode = opts.mode ?? 'set';
  const amount = opts.amount;
  if (!uid && !billingAccountId) throw new Error('uid or billingAccountId required');
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

  return withTx(async (tx) => {
    if (await creditTransactionExists(tx, requestId)) {
      const billing = billingAccountId
        ? await lockBillingById(tx, billingAccountId)
        : await getBillingByUserId(tx, uid!);
      const b = readBalances(billing);
      return { ...b, requestId };
    }

    let billing;
    if (billingAccountId) {
      billing = await lockBillingById(tx, billingAccountId);
    } else {
      // Firestore parity: the first-ever grant for a brand-new user creates its wallet row.
      await ensureUserAndBilling(tx, uid!);
      billing = await lockBillingByUserId(tx, uid!);
    }
    if (!billing) throw new Error('billing account missing after ensure');

    // Cron reads due rows without a lock, then SETs here. Re-check on the locked
    // row so a concurrent subscription.charged SET that already advanced
    // next_allocation_date is not overwritten.
    let grantAmount = amount;
    let patch: Record<string, unknown> | undefined = userPatch;
    if (bucket === 'allocation' && mode === 'set' && reason === 'cron.allocation_refresh') {
      const due = refreshAllocationIfDue({
        planStatus: billing.planStatus,
        creditsIncluded: billing.creditsIncluded,
        allocationBalance: billing.allocationBalance,
        nextAllocationDate: billing.nextAllocationDate,
      });
      if (!due) {
        const b = readBalances(billing);
        return { ...b, requestId };
      }
      grantAmount = due.allocationBalance;
      patch = { ...(userPatch ?? {}), nextAllocationDate: due.nextAllocationDate };
    }

    const current = readBalances(billing);
    const lotSubId =
      opts.razorpaySubscriptionId ??
      billing.razorpaySubscriptionId ??
      null;
    const lotExpires =
      opts.expiresAt ??
      (bucket === 'allocation' ? billing.currentPeriodEnd : null);

    let debtRecovered = 0;
    let grantLedgerAmount = grantAmount;
    if (bucket === 'topUp' && current.topUpBalance < 0 && grantAmount > 0) {
      // Legacy repay (pre-2b-a negative top_up). New debt lives on sponsored.
      debtRecovered = Math.min(grantAmount, -current.topUpBalance);
      grantLedgerAmount = grantAmount - debtRecovered;
    }

    let nextAlloc = current.allocationBalance;
    let nextTopUp = current.topUpBalance;
    if (bucket === 'allocation') {
      if (mode === 'add') {
        nextAlloc = current.allocationBalance + grantAmount;
      } else if (lotSubId) {
        const lots = await loadAllocationLots(tx, billing.id);
        if (lots.length === 0) {
          // No stamped lots yet — legacy full SET.
          nextAlloc = grantAmount;
        } else {
          const lotRem = remainingForSubscription(
            lots,
            current.allocationBalance,
            lotSubId
          );
          nextAlloc = current.allocationBalance - lotRem + grantAmount;
          if (lotRem > 0) {
            await insertCreditTransaction(tx, `${requestId}:expire_lot`, billing.id, {
              user_id: billing.ownerUserId ?? uid ?? null,
              org_id: billing.ownerOrgId,
              type: 'expire',
              amount: lotRem,
              bucket: 'allocation',
              request_id: requestId,
              reason: `${reason}.lot_replace`,
              razorpay_subscription_id: lotSubId,
            });
          }
        }
      } else {
        nextAlloc = grantAmount;
      }
    } else {
      nextTopUp = current.topUpBalance + grantAmount;
    }

    const next: BucketBalances = {
      allocationBalance: nextAlloc,
      topUpBalance: nextTopUp,
    };

    const balancePatch = {
      allocationBalance: next.allocationBalance,
      topUpBalance: next.topUpBalance,
      ...(bucket === 'topUp'
        ? {
            topUpReference: next.topUpBalance > 0 ? next.topUpBalance : billing.topUpReference,
            topUpPurchasedTotal: nextTopUpPurchasedTotal(
              readInt(billing.topUpPurchasedTotal),
              grantAmount,
              next.topUpBalance
            ),
          }
        : {
            allocationGrantedTotal: nextAllocationGrantedTotal(
              mode,
              readInt(billing.allocationGrantedTotal),
              grantAmount,
              next.allocationBalance
            ),
          }),
      ...(patch ?? {}),
    };
    if (billingAccountId) {
      await updateBillingById(tx, billing.id, balancePatch);
    } else {
      await updateBillingByUserId(tx, uid!, balancePatch);
    }

    if (bucket === 'topUp' && debtRecovered > 0) {
      await insertCreditTransaction(tx, `${requestId}:debt`, billing.id, {
        user_id: billing.ownerUserId ?? uid ?? null,
        org_id: billing.ownerOrgId,
        type: 'debt_recovery',
        amount: debtRecovered,
        bucket: 'top_up',
        request_id: requestId,
        reason: `${reason}.debt`,
      });
    }

    if (grantLedgerAmount > 0 || (mode === 'add' && bucket === 'allocation')) {
      const expiresAt =
        bucket === 'topUp'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : lotExpires;
      await insertCreditTransaction(tx, requestId, billing.id, {
        user_id: billing.ownerUserId ?? uid ?? null,
        org_id: billing.ownerOrgId,
        type: 'grant',
        amount: grantLedgerAmount > 0 ? grantLedgerAmount : grantAmount,
        bucket: bucket === 'topUp' ? 'top_up' : 'allocation',
        request_id: requestId,
        reason,
        mode,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
        ...(bucket === 'allocation' && lotSubId
          ? { razorpay_subscription_id: lotSubId }
          : {}),
      });
    }

    if (opts.planAudit && billing.ownerOrgId) {
      await writeAuditLog(tx, {
        orgId: billing.ownerOrgId,
        actorUserId: 'system',
        action: opts.planAudit.action,
        targetType: 'organization',
        targetId: billing.ownerOrgId,
        metadata: opts.planAudit.metadata,
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
