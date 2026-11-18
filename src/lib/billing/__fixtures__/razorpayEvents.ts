/**
 * Razorpay webhook payload fixtures (shapes match Razorpay's documented
 * subscription/payment/invoice entities). Layer 1 test-only.
 */
import {
  getRazorpayPlanId,
  type BillingCurrency,
  type BillingPeriod,
  type SelfServePlanType,
} from '@/config/razorpay'

export type SubFixtureOpts = {
  subscriptionId: string
  userId: string
  planType: SelfServePlanType
  billingPeriod?: BillingPeriod
  currency?: BillingCurrency
  status?: string
  currentStart: number // unix seconds
  currentEnd: number // unix seconds
  /** Future first charge (downgrade start_at). */
  startAt?: number
  notes?: Record<string, string>
}

function subscriptionEntity(opts: SubFixtureOpts): Record<string, unknown> {
  const billingPeriod = opts.billingPeriod ?? 'monthly'
  const currency = opts.currency ?? 'USD'
  return {
    id: opts.subscriptionId,
    entity: 'subscription',
    plan_id: getRazorpayPlanId(opts.planType, billingPeriod, currency),
    status: opts.status ?? 'active',
    current_start: opts.currentStart,
    current_end: opts.currentEnd,
    ...(opts.startAt != null ? { start_at: opts.startAt } : {}),
    charge_at: opts.currentEnd,
    total_count: billingPeriod === 'annual' ? 1 : 12,
    paid_count: 1,
    customer_notify: 1,
    created_at: opts.currentStart,
    has_scheduled_changes: false,
    notes: {
      userId: opts.userId,
      planType: opts.planType,
      billingPeriod,
      currency,
      ...(opts.notes ?? {}),
    },
  }
}

function paymentEntity(opts: {
  id?: string
  method?: string
  amount?: number
  notes?: Record<string, string>
}): Record<string, unknown> {
  return {
    id: opts.id ?? `pay_${Date.now().toString(16)}`,
    entity: 'payment',
    amount: opts.amount ?? 0,
    currency: 'USD',
    status: 'captured',
    method: opts.method ?? 'card',
    notes: opts.notes ?? {},
  }
}

/** subscription.activated */
export function subscriptionActivatedPayload(
  opts: SubFixtureOpts & { paymentMethod?: string; paymentId?: string }
) {
  return {
    subscription: { entity: subscriptionEntity(opts) },
    payment: { entity: paymentEntity({ method: opts.paymentMethod, id: opts.paymentId }) },
  }
}

/** subscription.charged (renewal) */
export function subscriptionChargedPayload(
  opts: SubFixtureOpts & { paymentMethod?: string; paymentId?: string }
) {
  return {
    subscription: { entity: subscriptionEntity(opts) },
    payment: { entity: paymentEntity({ method: opts.paymentMethod, id: opts.paymentId }) },
  }
}

/** subscription.updated (plan change) */
export function subscriptionUpdatedPayload(
  opts: SubFixtureOpts & { hasScheduledChanges?: boolean; changeScheduledAt?: number; updatedAt?: number }
) {
  const entity = subscriptionEntity(opts)
  return {
    subscription: {
      entity: {
        ...entity,
        has_scheduled_changes: opts.hasScheduledChanges ?? false,
        change_scheduled_at: opts.changeScheduledAt,
        updated_at: opts.updatedAt ?? opts.currentStart,
      },
    },
  }
}

/** subscription.pending / halted / cancelled / paused / resumed / completed — status-only events. */
export function subscriptionStatusPayload(opts: SubFixtureOpts) {
  return { subscription: { entity: subscriptionEntity(opts) } }
}

/** subscription.authenticated (Checkout authorized; no planStatus write). */
export function subscriptionAuthenticatedPayload(opts: SubFixtureOpts) {
  return {
    subscription: {
      entity: subscriptionEntity({ ...opts, status: opts.status ?? 'authenticated' }),
    },
  }
}

/** payment.captured for the Payment-Link add-credits path (no order_id). */
export function paymentCapturedAddCreditsPayload(opts: {
  paymentId: string
  uid: string
  amountUsd: number
}) {
  return {
    payment: {
      entity: paymentEntity({
        id: opts.paymentId,
        method: 'upi',
        amount: Math.round(opts.amountUsd * 100),
        notes: { purpose: 'nia_add_credits', uid: opts.uid, amountUsd: String(opts.amountUsd) },
      }),
    },
  }
}
