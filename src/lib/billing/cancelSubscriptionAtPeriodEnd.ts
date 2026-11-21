/**
 * Post-commit Razorpay cancel-at-period-end (plan §5.3).
 * Never call inside a DB transaction. Bounded retries; HIGH ops_alerts on failure.
 * Does not roll back the wallet/parent change that already committed.
 */
import Razorpay from 'razorpay'

import { RAZORPAY_CONFIG } from '@/config/razorpay'
import { sql } from '@/lib/db/client'
import { getRazorpaySubscription, updateBillingById, upsertRazorpaySubscription } from '@/lib/db/wallet'

const DEFAULT_ATTEMPTS = 3

export type CancelAfterCommitResult = {
  cancelled: boolean
  already: boolean
  alerted: boolean
}

async function writeHighAlert(opts: {
  id: string
  condition: string
  billingAccountId: string
  subscriptionId: string
  error: string
}): Promise<void> {
  await sql`
    insert into ops_alerts (id, data)
    values (
      ${opts.id},
      ${JSON.stringify({
        severity: 'HIGH',
        condition: opts.condition,
        id: opts.id,
        text: 'Razorpay cancel-at-period-end failed after conversion/accept',
        billingAccountId: opts.billingAccountId,
        subscriptionId: opts.subscriptionId,
        error: opts.error,
        resolved: false,
      })}::jsonb
    )
    on conflict (id) do nothing
  `
}

/**
 * Cancel the subscription at cycle end. Safe to call when subscriptionId is null (no-op).
 */
export async function cancelSubscriptionAtPeriodEndAfterCommit(opts: {
  billingAccountId: string
  razorpaySubscriptionId: string | null | undefined
  reason: string
  maxAttempts?: number
}): Promise<CancelAfterCommitResult> {
  const subId = opts.razorpaySubscriptionId?.trim() || null
  if (!subId) {
    return { cancelled: false, already: false, alerted: false }
  }

  const existing = await getRazorpaySubscription(sql, subId)
  if (existing?.cancelAtCycleEnd) {
    await updateBillingById(sql, opts.billingAccountId, { cancelAtPeriodEnd: true })
    return { cancelled: false, already: true, alerted: false }
  }

  const attempts = opts.maxAttempts ?? DEFAULT_ATTEMPTS
  let lastError = 'unknown'
  for (let i = 0; i < attempts; i++) {
    try {
      const razorpay = new Razorpay({
        key_id: RAZORPAY_CONFIG.keyId,
        key_secret: RAZORPAY_CONFIG.keySecret,
      })
      await razorpay.subscriptions.cancel(subId, 1)
      await upsertRazorpaySubscription(sql, subId, opts.billingAccountId, {
        cancelAtCycleEnd: true,
        cancelledAt: new Date(),
      })
      await updateBillingById(sql, opts.billingAccountId, { cancelAtPeriodEnd: true })
      return { cancelled: true, already: false, alerted: false }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  const alertId = `rzp-cancel-fail-${opts.billingAccountId}-${subId}`.slice(0, 200)
  await writeHighAlert({
    id: alertId,
    condition: opts.reason,
    billingAccountId: opts.billingAccountId,
    subscriptionId: subId,
    error: lastError,
  })
  // Still mark the wallet so Billing shows the ending banner; Razorpay may catch up.
  await updateBillingById(sql, opts.billingAccountId, { cancelAtPeriodEnd: true })
  return { cancelled: false, already: false, alerted: true }
}
