/**
 * Usage / dashboard period window (2b-c).
 * Subscription wallets: open cycle implied by current_period_end + billing_cycle.
 * Prepaid child wallets: calendar month UTC (matches 1.5% window).
 */

export type PeriodWindow = { from: Date; to: Date }

function addMonthsUtc(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  out.setUTCMonth(out.getUTCMonth() + months)
  return out
}

/**
 * Inclusive-start exclusive-end window for usage queries.
 * `to` is "now" capped at period end when the cycle is still open.
 */
export function usagePeriodWindow(opts: {
  accessMode: string
  billingCycle: string | null
  currentPeriodEnd: Date | null
  now?: Date
}): PeriodWindow {
  const now = opts.now ?? new Date()
  if (opts.accessMode === 'prepaid') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
    return { from, to }
  }

  const end = opts.currentPeriodEnd
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    const from = new Date(now.getTime() - 30 * 864e5)
    return { from, to: now }
  }

  const months = opts.billingCycle === 'annual' ? 12 : 1
  const from = addMonthsUtc(end, -months)
  const to = end.getTime() > now.getTime() ? now : end
  return { from, to }
}
