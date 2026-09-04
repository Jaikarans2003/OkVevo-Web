import { Timestamp } from 'firebase/firestore';

/** grant | debit | refund — amount is always a non-negative platform credit unit, integer. */
export type TransactionType = 'grant' | 'debit' | 'refund';

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
    createdAt: Timestamp;
}

export interface UserCredits {
    plan: string | null;
    razorpayCustomerId?: string;
    razorpaySubscriptionId?: string;
    /** Platform credit unit, integer. */
    creditBalance: number;
    createdAt: Timestamp;
}
