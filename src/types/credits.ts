import { Timestamp } from 'firebase/firestore';

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
    razorpayCustomerId?: string;
    razorpaySubscriptionId?: string;
    /** Monthly plan grant size (denormalized for % math). */
    creditsIncluded: number;
    /** Plan wallet — spent first (FIFO). */
    allocationBalance: number;
    /** Purchased wallet — spent after allocation is 0. */
    topUpBalance: number;
    /** Due-date gate for charged + daily cron. */
    nextAllocationDate?: Timestamp | null;
    currentPeriodEnd?: Timestamp | null;
    /** Optimistic cancel-at-cycle-end flag (set by cancel route). */
    cancelAtPeriodEnd?: boolean;
    createdAt: Timestamp;
}

/** remainingPct for UI — never show raw allocationBalance as the period figure. */
export function remainingPct(creditsIncluded: number, allocationBalance: number): number {
    if (!Number.isInteger(creditsIncluded) || creditsIncluded <= 0) return 0;
    if (!Number.isInteger(allocationBalance) || allocationBalance < 0) return 0;
    return allocationBalance / creditsIncluded;
}

/** Available spend = sum of both buckets (gateway still requires planStatus == active). */
export function availableCredits(allocationBalance: number, topUpBalance: number): number {
    const a = Number.isInteger(allocationBalance) && allocationBalance >= 0 ? allocationBalance : 0;
    const t = Number.isInteger(topUpBalance) && topUpBalance >= 0 ? topUpBalance : 0;
    return a + t;
}
