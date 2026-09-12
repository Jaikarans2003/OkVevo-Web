/**
 * users/{uid} is the only billing SoT. Do not read users/{uid}/subscriptions
 * or razorpaySubscriptions.
 */
import type { BillingCurrency } from '@/config/razorpay';
import { isBillingCurrency } from '@/config/razorpay';
import type { DocumentData, Timestamp } from 'firebase-admin/firestore';

export type UserPaymentMethod = 'card' | 'upi' | 'emandate' | 'netbanking';

export type UserBillingSoT = {
  uid: string;
  razorpaySubscriptionId: string | null;
  plan: string | null;
  planName: string | null;
  planStatus: string | null;
  billingCycle: string | null;
  currency: BillingCurrency | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Timestamp | null;
  hasScheduledChanges: boolean;
  scheduledPlanType: string | null;
  scheduledPlanId: string | null;
  paymentMethod: UserPaymentMethod | null;
};

export type SubscriptionEventKind =
  | 'activated'
  | 'cancelled'
  | 'charged'
  | 'updated'
  | 'paused'
  | 'halted'
  | 'pending'
  | 'completed'
  | 'resumed';

export type PointerDecision =
  | { apply: true; reason: 'current' | 'replacement' | 'first_or_recovery' }
  | { apply: false; reason: 'stale' };

const PAYMENT_METHODS: readonly UserPaymentMethod[] = [
  'card',
  'upi',
  'emandate',
  'netbanking',
];

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

export function normalizePaymentMethod(v: unknown): UserPaymentMethod | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim().toLowerCase();
  if (s === 'creditcard' || s === 'debitcard') return 'card';
  if ((PAYMENT_METHODS as readonly string[]).includes(s)) return s as UserPaymentMethod;
  if (s.includes('upi')) return 'upi';
  if (s.includes('emandate') || s === 'nach') return 'emandate';
  return null;
}

export function isUpiLikePaymentMethod(v: string | null | undefined): boolean {
  return v === 'upi' || v === 'emandate';
}

export function razorpayErrorDescription(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Request failed';
  const e = error as { error?: { description?: unknown }; message?: unknown };
  if (typeof e.error?.description === 'string' && e.error.description.trim()) {
    return e.error.description.trim();
  }
  if (typeof e.message === 'string' && e.message.trim()) return e.message.trim();
  return 'Request failed';
}

/** Razorpay Update Subscription rejects UPI/eMandate; never surface that string to the client. */
export function isUpiSubscriptionUpdateError(error: unknown): boolean {
  return /cannot be updated when payment mode|payment mode is upi|emandate/i.test(
    razorpayErrorDescription(error)
  );
}

export function userBillingFromData(uid: string, data: DocumentData | undefined): UserBillingSoT {
  if (!data) {
    return {
      uid,
      razorpaySubscriptionId: null,
      plan: null,
      planName: null,
      planStatus: null,
      billingCycle: null,
      currency: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      hasScheduledChanges: false,
      scheduledPlanType: null,
      scheduledPlanId: null,
      paymentMethod: null,
    };
  }
  return {
    uid,
    razorpaySubscriptionId: asString(data.razorpaySubscriptionId),
    plan: asString(data.plan),
    planName: asString(data.planName),
    planStatus: asString(data.planStatus),
    billingCycle: asString(data.billingCycle),
    currency: isBillingCurrency(data.currency) ? data.currency : null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
    currentPeriodEnd: data.currentPeriodEnd ?? null,
    hasScheduledChanges: data.hasScheduledChanges === true,
    scheduledPlanType: asString(data.scheduledPlanType),
    scheduledPlanId: asString(data.scheduledPlanId),
    paymentMethod: normalizePaymentMethod(data.paymentMethod),
  };
}

export async function loadUserBillingSoT(uid: string): Promise<UserBillingSoT> {
  const { db } = await import('@/lib/firebase-admin');
  const snap = await db.collection('users').doc(uid).get();
  return userBillingFromData(uid, snap.exists ? snap.data() : undefined);
}

export function isCancellablePlanStatus(status: string | null): boolean {
  return status === 'active';
}

export function isUpdatablePlanStatus(status: string | null): boolean {
  return status === 'active' || status === 'authenticated';
}

function isReplacementNotes(notes?: {
  upgrade_flow?: string;
  replacing_subscription_id?: string;
}): notes is { upgrade_flow: 'true'; replacing_subscription_id: string } {
  return (
    notes?.upgrade_flow === 'true' &&
    typeof notes.replacing_subscription_id === 'string' &&
    notes.replacing_subscription_id.length > 0
  );
}

function isTerminalPlanStatus(status: string | null | undefined): boolean {
  return status === 'cancelled' || status === 'completed';
}

/**
 * Current-subscription pointer (Stripe Customer.subscription shape).
 * Historical Razorpay subs may still emit events; those must not mutate users/{uid}.
 */
export function shouldApplySubscriptionEvent(opts: {
  eventSubId: string | null | undefined;
  currentSubId: string | null | undefined;
  event: SubscriptionEventKind;
  notes?: { upgrade_flow?: string; replacing_subscription_id?: string };
  currentPlanStatus?: string | null;
}): PointerDecision {
  const eventSubId = asString(opts.eventSubId);
  const currentSubId = asString(opts.currentSubId);
  const notes = opts.notes;

  if (opts.event === 'activated' && isReplacementNotes(notes)) {
    return notes.replacing_subscription_id === currentSubId
      ? { apply: true, reason: 'replacement' }
      : { apply: false, reason: 'stale' };
  }

  if (eventSubId && currentSubId && eventSubId === currentSubId) {
    return { apply: true, reason: 'current' };
  }

  if (
    opts.event === 'activated' &&
    !isReplacementNotes(notes) &&
    eventSubId &&
    (!currentSubId || isTerminalPlanStatus(opts.currentPlanStatus))
  ) {
    return { apply: true, reason: 'first_or_recovery' };
  }

  return { apply: false, reason: 'stale' };
}

export function logStaleSubscriptionEvent(opts: {
  uid: string;
  event: string;
  eventSubId: string | null;
  currentSubId: string | null;
}): void {
  console.warn('stale subscription event', opts);
}
