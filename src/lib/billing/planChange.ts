/**
 * Razorpay-native plan change (industry: Stripe-style upgrade-now / downgrade-at-period-end).
 * Billing anchor never resets — callers must not send start_at or remaining_count.
 */

export type ScheduleChangeAt = 'now' | 'cycle_end';
export type PlanChangeTier = 'starter' | 'pro' | 'max';
export type PlanChangePeriod = 'monthly' | 'annual';
export type PortalBillingAction = 'overview' | 'change-plan' | 'cancel' | 'upgrade';

export const SELF_SERVE_TIERS: readonly PlanChangeTier[] = ['starter', 'pro', 'max'];

const TIER_RANK: Record<PlanChangeTier, number> = {
  starter: 1,
  pro: 2,
  max: 3,
};

export function isPlanChangeTier(v: string | null | undefined): v is PlanChangeTier {
  return v === 'starter' || v === 'pro' || v === 'max';
}

function isTier(v: string): v is PlanChangeTier {
  return isPlanChangeTier(v);
}

/** Next paid tier for the Upgrade card. Max has none. */
export function nextUpgradeTier(current: string | null | undefined): PlanChangeTier | null {
  if (!current || !isPlanChangeTier(current)) return null;
  const i = SELF_SERVE_TIERS.indexOf(current);
  return i >= 0 && i < SELF_SERVE_TIERS.length - 1 ? SELF_SERVE_TIERS[i + 1] : null;
}

export function isLivePlanStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'authenticated' || status === 'paused' || status === 'pending';
}

export function portalBillingActionFromSlug(
  slug: string | string[] | undefined
): PortalBillingAction {
  const first = Array.isArray(slug) ? slug[0] : slug;
  if (first === 'change-plan' || first === 'cancel' || first === 'upgrade') return first;
  return 'overview';
}

export function planChangeCopy(
  when: ScheduleChangeAt,
  opts?: { upi?: boolean }
): string {
  if (opts?.upi) {
    return when === 'now'
      ? 'You will pay the full new-plan price via a new UPI payment. Existing credits stay until the new billing date.'
      : 'This change takes effect at the end of your current billing cycle. You will not be charged now.';
  }
  return when === 'now'
    ? 'You will pay the prorated difference now. Your billing date stays the same.'
    : 'This change takes effect at the end of your current billing cycle. You will not be charged now.';
}

export function toBillingPeriod(cycle: string | null | undefined): PlanChangePeriod {
  return cycle === 'yearly' || cycle === 'annual' ? 'annual' : 'monthly';
}

export function isSamePlan(
  currentPlan: string | null,
  currentCycle: string | null | undefined,
  newPlan: PlanChangeTier,
  newPeriod: PlanChangePeriod
): boolean {
  return currentPlan === newPlan && toBillingPeriod(currentCycle) === newPeriod;
}

/** Higher tier, or same-tier monthly → annual, is an upgrade (prorate now). */
export function scheduleChangeAt(
  currentPlan: string | null,
  currentCycle: string | null | undefined,
  newPlan: PlanChangeTier,
  newPeriod: PlanChangePeriod
): ScheduleChangeAt {
  const currentRank = currentPlan && isTier(currentPlan) ? TIER_RANK[currentPlan] : 0;
  const nextRank = TIER_RANK[newPlan];
  if (nextRank !== currentRank) {
    return nextRank > currentRank ? 'now' : 'cycle_end';
  }
  const currentPeriod = toBillingPeriod(currentCycle);
  if (currentPeriod === newPeriod) return 'now';
  return newPeriod === 'annual' ? 'now' : 'cycle_end';
}

/** Immediate upgrade: ADD max(0, new − old). Downgrade delta is 0 — do not claw back. */
export function allocationCreditDelta(fromIncluded: unknown, toIncluded: number): number {
  const from =
    typeof fromIncluded === 'number' && Number.isInteger(fromIncluded) && fromIncluded >= 0
      ? fromIncluded
      : 0;
  const delta = toIncluded - from;
  return delta > 0 ? delta : 0;
}

/**
 * Card immediate upgrade: floor(delta * remaining / period), clamp 0…delta.
 * UPI stacked upgrades do not use this — they ADD the full new grant.
 */
export function proratedCreditGrant(delta: number, remaining: number, period: number): number {
  if (!Number.isInteger(delta) || delta <= 0) return 0;
  if (!(period > 0) || !Number.isFinite(remaining) || !Number.isFinite(period)) return 0;
  const ratio = Math.min(1, Math.max(0, remaining / period));
  return Math.min(delta, Math.floor(delta * ratio));
}

/** subscription.charged: payload plan wins so cycle-end downgrades grant the new plan. */
export function creditsIncludedForCharge(
  payloadCreditsIncluded: number | undefined,
  storedCreditsIncluded: unknown
): number | undefined {
  if (typeof payloadCreditsIncluded === 'number' && Number.isInteger(payloadCreditsIncluded)) {
    return payloadCreditsIncluded;
  }
  if (
    typeof storedCreditsIncluded === 'number' &&
    Number.isInteger(storedCreditsIncluded) &&
    storedCreditsIncluded >= 0
  ) {
    return storedCreditsIncluded;
  }
  return undefined;
}

export function hasScheduledPlanChange(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** Idempotency key: subscription id + updated_at, falling back to webhook created_at. */
export function subscriptionUpdatedRequestId(
  subscriptionId: string,
  updatedAt: unknown,
  eventCreatedAt?: unknown
): string {
  const primary =
    typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : null;
  const fallback =
    typeof eventCreatedAt === 'number' && Number.isFinite(eventCreatedAt)
      ? eventCreatedAt
      : null;
  return `sub_updated_${subscriptionId}_${primary ?? fallback ?? 0}`;
}
