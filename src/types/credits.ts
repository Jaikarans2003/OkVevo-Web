import type { Timestamp } from 'firebase/firestore';

/** grant | debit | refund — amount is always a non-negative platform credit unit, integer. */
export type TransactionType = 'grant' | 'debit' | 'refund';

export type PlanStatus = 'active' | 'cancelled' | 'paused' | 'halted' | null;

export type BillingCycle = 'monthly' | 'yearly';

export interface CreditTransaction {
    id: string;
    uid: string;
    type: TransactionType;
    /** Platform credit unit, integer. */
    amount: number;
    model?: string;
    provider?: string;
    promptTokens?: number;
    completionTokens?: number;
    /** Internal margin/audit only — do not show in billing UI. */
    costUsd?: number;
    /** Internal margin/audit only — do not show in billing UI. */
    priceUsd?: number;
    requestId?: string;
    /** Which wallet was credited (grants only). */
    bucket?: 'allocation' | 'topUp';
    createdAt: Timestamp;
}

/**
 * Spendable SoT on users/{uid}. Two prepaid wallets:
 * - allocationBalance: plan grant; forfeited on refresh
 * - topUpBalance: Payment Link purchases; never expires on its own
 * Dropped: creditBalance as SoT (migrate once → topUpBalance).
 */
export interface UserCredits {
    plan: string | null;
    planName?: string | null;
    planStatus?: PlanStatus;
    billingCycle?: BillingCycle | null;
    /** Checkout book. Plan changes stay in this currency. Admin-only. */
    currency?: 'USD' | 'INR' | null;
    razorpayCustomerId?: string;
    razorpaySubscriptionId?: string;
    /** Instrument on the current subscription. CamelCase only — never payment_method. */
    paymentMethod?: 'card' | 'upi' | 'emandate' | 'netbanking' | null;
    /** Monthly plan grant size (denormalized for % math). */
    creditsIncluded: number;
    /** Plan wallet — spent first (FIFO). */
    allocationBalance: number;
    /** Purchased wallet — spent after allocation is 0. */
    topUpBalance: number;
    /** Lifetime top-up grants. Additional remaining % denominator. Admin-only. */
    topUpPurchasedTotal?: number;
    /** Credits granted this billing cycle (SET replaces, ADD grows). Plan remaining % denominator. Admin-only. */
    allocationGrantedTotal?: number;
    /** Due-date gate for charged + daily cron. */
    nextAllocationDate?: Timestamp | null;
    currentPeriodEnd?: Timestamp | null;
    /** True only if the current sub was cancelled via Cancel Subscription. */
    cancelAtPeriodEnd?: boolean;
    hasScheduledChanges?: boolean;
    scheduledPlanType?: string | null;
    scheduledPlanId?: string | null;
    scheduledChangeAt?: Timestamp | null;
    createdAt: Timestamp;
}

/** 0–100, two-decimal floor. Never round up — 19931/20000 is 99.65, not 99.66 or 100. */
export function flooredPct(remaining: number, total: number): number {
    if (!Number.isInteger(total) || total <= 0) return 0;
    if (!Number.isInteger(remaining) || remaining < 0) return 0;
    return Math.min(100, Math.floor((remaining / total) * 10000) / 100);
}

/** Trim trailing zeros from a 0–100 pct: 87.5%, 99.86%, 50%, 100%. */
export function formatPctLabel(pct: number): string {
    if (!Number.isFinite(pct)) return '0%';
    const hundredths = Math.round(Math.min(100, Math.max(0, pct)) * 100);
    const whole = Math.floor(hundredths / 100);
    const frac = hundredths % 100;
    if (frac === 0) return `${whole}%`;
    if (frac % 10 === 0) return `${whole}.${frac / 10}%`;
    return `${whole}.${String(frac).padStart(2, '0')}%`;
}

/**
 * Plan remaining for UI. Denom is this-cycle grant total; fallback creditsIncluded
 * when the field is 0/missing. Never leftover-as-base (that forces 100% after ADD).
 */
export function remainingPct(
    creditsIncluded: number,
    allocationBalance: number,
    allocationGrantedTotal?: number
): number {
    const granted =
        typeof allocationGrantedTotal === 'number' &&
        Number.isInteger(allocationGrantedTotal) &&
        allocationGrantedTotal > 0
            ? allocationGrantedTotal
            : creditsIncluded;
    return flooredPct(allocationBalance, granted);
}

/** Additional remaining. Denominator is max(purchasedTotal, leftover) so unseeded leftover never exceeds 100%. */
export function additionalRemainingPct(topUpBalance: number, topUpPurchasedTotal: number): number {
    const purchased =
        Number.isInteger(topUpPurchasedTotal) && topUpPurchasedTotal >= 0 ? topUpPurchasedTotal : 0;
    const leftover = Number.isInteger(topUpBalance) && topUpBalance >= 0 ? topUpBalance : 0;
    return flooredPct(leftover, Math.max(purchased, leftover));
}

/**
 * SET replaces the cycle tank with the grant; ADD grows it.
 * nextAllocationBalance is only a floor so leftover cannot exceed the bar.
 */
export function nextAllocationGrantedTotal(
    mode: 'set' | 'add',
    oldGranted: number,
    grantAmount: number,
    nextAllocationBalance: number
): number {
    const grant = Number.isInteger(grantAmount) && grantAmount >= 0 ? grantAmount : 0;
    const nextBal =
        Number.isInteger(nextAllocationBalance) && nextAllocationBalance >= 0
            ? nextAllocationBalance
            : 0;
    if (mode === 'set') return grant;
    const current = Number.isInteger(oldGranted) && oldGranted >= 0 ? oldGranted : 0;
    return Math.max(current + grant, nextBal);
}

/** Replay one allocation grant: missing mode is SET. Debits are not grants. */
export function replayAllocationGrant(tank: number, amount: number, mode: unknown): number {
    const grant = Number.isInteger(amount) && amount >= 0 ? amount : 0;
    if (mode === 'add') {
        const current = Number.isInteger(tank) && tank >= 0 ? tank : 0;
        return current + grant;
    }
    return grant;
}

/** One-time backfill: never decrease an existing field. Do not max with leftover. */
export function seedAllocationGrantedTotal(currentGranted: number, ledgerTank: number): number {
    const current = Number.isInteger(currentGranted) && currentGranted >= 0 ? currentGranted : 0;
    const tank = Number.isInteger(ledgerTank) && ledgerTank >= 0 ? ledgerTank : 0;
    return Math.max(current, tank);
}

/** topUp grant: ADD to the lifetime denominator, and self-heal leftover that predates the field. */
export function nextTopUpPurchasedTotal(
    currentPurchased: number,
    grantAmount: number,
    nextTopUpBalance: number
): number {
    const current = Number.isInteger(currentPurchased) && currentPurchased >= 0 ? currentPurchased : 0;
    const grant = Number.isInteger(grantAmount) && grantAmount >= 0 ? grantAmount : 0;
    const bal = Number.isInteger(nextTopUpBalance) && nextTopUpBalance >= 0 ? nextTopUpBalance : 0;
    return Math.max(current + grant, bal);
}

/** One-time backfill: never decrease an existing field; never go below leftover or ledger sum. */
export function seedTopUpPurchasedTotal(
    currentPurchased: number,
    ledgerSum: number,
    topUpBalance: number
): number {
    const current = Number.isInteger(currentPurchased) && currentPurchased >= 0 ? currentPurchased : 0;
    const ledger = Number.isInteger(ledgerSum) && ledgerSum >= 0 ? ledgerSum : 0;
    const bal = Number.isInteger(topUpBalance) && topUpBalance >= 0 ? topUpBalance : 0;
    return Math.max(current, ledger, bal);
}

/** Available spend = sum of both buckets (gateway still requires planStatus == active). */
export function availableCredits(allocationBalance: number, topUpBalance: number): number {
    const a = Number.isInteger(allocationBalance) && allocationBalance >= 0 ? allocationBalance : 0;
    const t = Number.isInteger(topUpBalance) && topUpBalance >= 0 ? topUpBalance : 0;
    return a + t;
}
