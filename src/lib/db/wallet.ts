/**
 * billing_accounts / gateway_jobs helpers for the Postgres port of the
 * gateway ledger (debit.ts, captureCredits.ts). Row <-> camelCase mappers
 * here feed the same pure `readBalances` / `jobFromSnap` shapes debit.ts
 * already uses, so the business logic stays untouched.
 * Lock order: billing_accounts -> spend_daily -> gateway_jobs -> fal_queues.
 */
import type { Sql } from 'postgres'

import type { TxSql } from '@/lib/db/tx'
import { omitUndefined } from '@/lib/gateway/reserve'

/** Either a bare client or an in-flight transaction — both are callable tagged templates. */
export type DbHandle = TxSql | Sql

export type BillingAccountData = {
  id: string
  ownerUserId: string
  plan: string | null
  planName: string | null
  planStatus: string | null
  billingCycle: string | null
  currency: string | null
  razorpayCustomerId: string | null
  razorpaySubscriptionId: string | null
  paymentMethod: string | null
  creditsIncluded: number
  allocationBalance: number
  topUpBalance: number
  allocationGrantedTotal: number
  topUpPurchasedTotal: number
  nextAllocationDate: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  hasScheduledChanges: boolean
  scheduledPlanType: string | null
  scheduledPlanId: string | null
  scheduledChangeAt: Date | null
  concurrencyOverride: number | null
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0) || 0
}

/** billing_accounts row -> camelCase data, same shape debit.ts's readBalances/readPlanStatus read. */
export function billingRowToData(row: Record<string, unknown> | undefined): BillingAccountData | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    plan: (row.plan as string | null) ?? null,
    planName: (row.plan_name as string | null) ?? null,
    planStatus: (row.plan_status as string | null) ?? null,
    billingCycle: (row.billing_cycle as string | null) ?? null,
    currency: (row.currency as string | null) ?? null,
    razorpayCustomerId: (row.razorpay_customer_id as string | null) ?? null,
    razorpaySubscriptionId: (row.razorpay_subscription_id as string | null) ?? null,
    paymentMethod: (row.payment_method as string | null) ?? null,
    creditsIncluded: num(row.credits_included),
    allocationBalance: num(row.allocation_balance),
    topUpBalance: num(row.top_up_balance),
    allocationGrantedTotal: num(row.allocation_granted_total),
    topUpPurchasedTotal: num(row.top_up_purchased_total),
    nextAllocationDate: (row.next_allocation_date as Date | null) ?? null,
    currentPeriodEnd: (row.current_period_end as Date | null) ?? null,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    hasScheduledChanges: row.has_scheduled_changes === true,
    scheduledPlanType: (row.scheduled_plan_type as string | null) ?? null,
    scheduledPlanId: (row.scheduled_plan_id as string | null) ?? null,
    scheduledChangeAt: (row.scheduled_change_at as Date | null) ?? null,
    concurrencyOverride: row.concurrency_override == null ? null : num(row.concurrency_override),
  }
}

/** Lock the wallet row for this user. Null when no billing_accounts row exists yet. */
export async function lockBillingByUserId(
  tx: TxSql,
  uid: string
): Promise<BillingAccountData | undefined> {
  const rows = await tx`select * from billing_accounts where owner_user_id = ${uid} for update`
  return billingRowToData(rows[0] as Record<string, unknown> | undefined)
}

export async function getBillingByUserId(
  db: DbHandle,
  uid: string
): Promise<BillingAccountData | undefined> {
  const rows = await db`select * from billing_accounts where owner_user_id = ${uid}`
  return billingRowToData(rows[0] as Record<string, unknown> | undefined)
}

/** Lazy-create users + billing_accounts rows. For tests, and grantCredits's first-ever grant. */
export async function ensureUserAndBilling(
  db: DbHandle,
  uid: string,
  seed?: Record<string, unknown>
): Promise<void> {
  await db`insert into users (id) values (${uid}) on conflict (id) do nothing`
  await db`insert into billing_accounts (owner_user_id) values (${uid}) on conflict (owner_user_id) do nothing`
  const patch = seed ? omitUndefined(toBillingRow(seed)) : {}
  if (Object.keys(patch).length > 0) {
    await db`update billing_accounts set ${db(patch)} where owner_user_id = ${uid}`
  }
}

/** camelCase billing-balance patch (allocationBalance/topUpBalance/...) -> snake_case SET fragment. */
export async function updateBillingByUserId(
  tx: TxSql,
  uid: string,
  patch: Record<string, unknown>
): Promise<void> {
  const row = omitUndefined(toBillingRow(patch))
  if (Object.keys(row).length === 0) return
  await tx`update billing_accounts set ${tx(row)}, updated_at = now() where owner_user_id = ${uid}`
}

const BILLING_KEY_MAP: Record<string, string> = {
  plan: 'plan',
  planName: 'plan_name',
  planStatus: 'plan_status',
  billingCycle: 'billing_cycle',
  currency: 'currency',
  razorpayCustomerId: 'razorpay_customer_id',
  razorpaySubscriptionId: 'razorpay_subscription_id',
  paymentMethod: 'payment_method',
  creditsIncluded: 'credits_included',
  allocationBalance: 'allocation_balance',
  topUpBalance: 'top_up_balance',
  allocationGrantedTotal: 'allocation_granted_total',
  topUpPurchasedTotal: 'top_up_purchased_total',
  nextAllocationDate: 'next_allocation_date',
  currentPeriodEnd: 'current_period_end',
  cancelAtPeriodEnd: 'cancel_at_period_end',
  hasScheduledChanges: 'has_scheduled_changes',
  scheduledPlanType: 'scheduled_plan_type',
  scheduledPlanId: 'scheduled_plan_id',
  scheduledChangeAt: 'scheduled_change_at',
  concurrencyOverride: 'concurrency_override',
}

function toBillingRow(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    const col = BILLING_KEY_MAP[k];
    if (col) out[col] = v
  }
  return out
}

const JOB_KEY_MAP: Record<string, string> = {
  uid: 'user_id',
  provider: 'provider',
  estimatedCredits: 'estimated_credits',
  status: 'status',
  heldAllocation: 'held_allocation',
  heldTopUp: 'held_top_up',
  endpoint: 'endpoint',
  unit: 'unit',
  unitPrice: 'unit_price',
  submitArgs: 'submit_args',
  falStatusUrl: 'fal_status_url',
  falResponseUrl: 'fal_response_url',
  falCancelUrl: 'fal_cancel_url',
  holdId: 'hold_id',
  payload: 'payload',
  character: 'character',
  project: 'project',
  consentAt: 'consent_at',
  sampleSha256: 'sample_sha256',
  media: 'media',
  priceSnapshot: 'price_snapshot',
  reservedFalUsd: 'reserved_fal_usd',
  spendDay: 'spend_day',
  queuePosition: 'queue_position',
  falRequestId: 'fal_request_id',
  runId: 'run_id',
  cancelRequested: 'cancel_requested',
  releaseReason: 'release_reason',
  clientMessage: 'client_message',
  clientCode: 'client_code',
  vendorStatus: 'vendor_status',
  submitAttempts: 'submit_attempts',
  firstRejectAtMs: 'first_reject_at_ms',
  nextAttemptAtMs: 'next_attempt_at_ms',
  falBody: 'fal_body',
  requestId: 'request_id',
  settledCredits: 'settled_credits',
  actualCredits: 'actual_credits',
  captured: 'captured',
  capturedAt: 'captured_at',
  capturedFalUsd: 'captured_fal_usd',
  aliasOf: 'alias_of',
  holdExpiresAt: 'hold_expires_at',
  createdAt: 'created_at',
  dispatchedAt: 'dispatched_at',
  settledAt: 'settled_at',
  settledFalUsd: 'settled_fal_usd',
}

/** camelCase job patch (GatewayJobFields-shaped) -> snake_case SET/INSERT fragment. Unknown keys drop. */
export function jobPatchToRow(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(omitUndefined(patch))) {
    const col = JOB_KEY_MAP[k]
    if (col) out[col] = v
  }
  return out
}

/** gateway_jobs row -> camelCase data, the shape jobFromSnap/readGatewayJob read. */
export function gatewayJobRowToData(row: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!row) return undefined
  const out: Record<string, unknown> = {}
  for (const [camel, col] of Object.entries(JOB_KEY_MAP)) {
    if (row[col] !== undefined) out[camel] = row[col]
  }
  out.aliasOf = row.alias_of ?? undefined
  return out
}

export async function getJob(db: DbHandle, id: string): Promise<Record<string, unknown> | undefined> {
  const rows = await db`select * from gateway_jobs where id = ${id}`
  return gatewayJobRowToData(rows[0] as Record<string, unknown> | undefined)
}

export async function lockJob(tx: TxSql, id: string): Promise<Record<string, unknown> | undefined> {
  const rows = await tx`select * from gateway_jobs where id = ${id} for update`
  return gatewayJobRowToData(rows[0] as Record<string, unknown> | undefined)
}

/** Insert a new gateway_jobs row. `id` is the requestId/holdId; billingAccountId comes from the caller's lock. */
export async function insertJob(
  db: DbHandle,
  id: string,
  uid: string,
  billingAccountId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const row = { id, user_id: uid, billing_account_id: billingAccountId, ...jobPatchToRow(patch) }
  await db`insert into gateway_jobs ${db(row)}`
}

export async function updateJob(db: DbHandle, id: string, patch: Record<string, unknown>): Promise<void> {
  const row = jobPatchToRow(patch)
  if (Object.keys(row).length === 0) return
  await db`update gateway_jobs set ${db(row)}, updated_at = now() where id = ${id}`
}

/** Idempotency check: does a credit_transactions row with this id already exist? */
export async function creditTransactionExists(db: DbHandle, id: string): Promise<boolean> {
  const rows = await db`select 1 from credit_transactions where id = ${id}`
  return rows.length > 0
}

/** credit_transactions insert. `id` is the ledger row id (requestId, or `${requestId}:capture`). */
export async function insertCreditTransaction(
  db: DbHandle,
  id: string,
  billingAccountId: string,
  row: Record<string, unknown>
): Promise<void> {
  const clean = omitUndefined(row)
  await db`insert into credit_transactions ${db({ id, billing_account_id: billingAccountId, ...clean })}
    on conflict (id) do nothing`
}

const SUBSCRIPTION_KEY_MAP: Record<string, string> = {
  status: 'status',
  planType: 'plan_type',
  chargeCount: 'charge_count',
  lastPaymentId: 'last_payment_id',
  lastPaymentAmount: 'last_payment_amount',
  lastPaymentDate: 'last_payment_at',
  cancelAtCycleEnd: 'cancel_at_cycle_end',
  couponCode: 'coupon_code',
  couponType: 'coupon_type',
  affiliateId: 'affiliate_id',
  discountAmount: 'discount_amount',
  couponApplied: 'coupon_applied',
  activatedAt: 'activated_at',
  haltedAt: 'halted_at',
  cancelledAt: 'cancelled_at',
  pausedAt: 'paused_at',
  resumedAt: 'resumed_at',
  completedAt: 'completed_at',
  expiresAt: 'expires_at',
  gracePeriodEndsAt: 'grace_period_ends_at',
  lastPaymentFailure: 'last_payment_failure',
  invoicePaidAt: 'invoice_paid_at',
  credits: 'credits',
  initialCredits: 'initial_credits',
  creditsUsed: 'credits_used',
  paymentMethod: 'payment_method',
  paymentMethodUpdatedAt: 'payment_method_updated_at',
  beingReplacedBy: 'being_replaced_by',
  willCancelAt: 'will_cancel_at',
  replacingSubscriptionId: 'replacing_subscription_id',
  willActivateAt: 'will_activate_at',
}

/** camelCase subscription patch -> snake_case SET fragment. Unknown keys (e.g. userId, subscriptionId) drop. */
function subscriptionPatchToRow(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(omitUndefined(patch))) {
    const col = SUBSCRIPTION_KEY_MAP[k]
    if (col) out[col] = v
  }
  return out
}

export type RazorpaySubscriptionData = {
  id: string
  userId: string | null
  status: string | null
  planType: string | null
  chargeCount: number
  couponCode: string | null
  invoicePaidAt: Date | null
} & Record<string, unknown>

/** razorpay_subscriptions row (joined for userId) -> camelCase. Null when no row exists. */
function subscriptionRowToData(
  row: (Record<string, unknown> & { user_id?: string | null }) | undefined
): RazorpaySubscriptionData | undefined {
  if (!row) return undefined
  const out: Record<string, unknown> = { id: String(row.id), userId: (row.user_id as string | null) ?? null }
  for (const [camel, col] of Object.entries(SUBSCRIPTION_KEY_MAP)) {
    out[camel] = row[col] ?? null
  }
  return out as RazorpaySubscriptionData
}

/** Fetch by subscription id. userId comes via the billing_accounts join (single source of truth). */
export async function getRazorpaySubscription(
  db: DbHandle,
  id: string
): Promise<RazorpaySubscriptionData | undefined> {
  const rows = await db`
    select rs.*, ba.owner_user_id as user_id
    from razorpay_subscriptions rs
    left join billing_accounts ba on ba.id = rs.billing_account_id
    where rs.id = ${id}
  `
  return subscriptionRowToData(rows[0] as Record<string, unknown> | undefined)
}

/**
 * Create-if-missing + patch a razorpay_subscriptions row (was the Firestore dual-write to
 * razorpaySubscriptions + users/{uid}/subscriptions — now a single table, no dual write).
 */
export async function upsertRazorpaySubscription(
  db: DbHandle,
  id: string,
  uid: string,
  patch: Record<string, unknown>
): Promise<void> {
  const billing = await getBillingByUserId(db, uid)
  await db`insert into razorpay_subscriptions (id, billing_account_id) values (${id}, ${billing?.id ?? null})
    on conflict (id) do nothing`
  const row = subscriptionPatchToRow(patch)
  if (Object.keys(row).length > 0) {
    await db`update razorpay_subscriptions set ${db(row)}, updated_at = now() where id = ${id}`
  }
}
