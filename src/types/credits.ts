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

/** 0–100 integer. Floor, never round — 19931/20000 is 99%, not 100%. */
export function flooredPct(remaining: number, total: number): number {
    if (!Number.isInteger(total) || total <= 0) return 0;
    if (!Number.isInteger(remaining) || remaining < 0) return 0;
    return Math.min(100, Math.floor((remaining / total) * 100));
}

/** Plan remaining for UI — floored 0–100, never a raw allocationBalance. */
export function remainingPct(creditsIncluded: number, allocationBalance: number): number {
    return flooredPct(allocationBalance, creditsIncluded);
}

/** Additional remaining. Denominator is max(purchasedTotal, leftover) so unseeded leftover never exceeds 100%. */
export function additionalRemainingPct(topUpBalance: number, topUpPurchasedTotal: number): number {
    const purchased =
        Number.isInteger(topUpPurchasedTotal) && topUpPurchasedTotal >= 0 ? topUpPurchasedTotal : 0;
    const leftover = Number.isInteger(topUpBalance) && topUpBalance >= 0 ? topUpBalance : 0;
    return flooredPct(leftover, Math.max(purchased, leftover));
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
