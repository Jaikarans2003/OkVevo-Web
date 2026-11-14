/**
 * Subscription entitlement: active plan and current period not ended.
 * No grace after current_period_end.
 */

export type EntitlementBilling = {
  planStatus?: string | null
  currentPeriodEnd?: Date | null
}

/** True only when planStatus is active and now is strictly before currentPeriodEnd. */
export function isEntitled(
  billing: EntitlementBilling | null | undefined,
  now: Date = new Date()
): boolean {
  if (!billing || billing.planStatus !== 'active') return false
  const end = billing.currentPeriodEnd
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) return false
  return now.getTime() < end.getTime()
}
