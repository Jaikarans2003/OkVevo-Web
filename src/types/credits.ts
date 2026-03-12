import { Timestamp } from 'firebase/firestore';

/**
 * Feature types that consume credits
 */
export type FeatureType = 'AI_INFLUENCER' | 'PRODUCT_SHOOTS' | 'PRODUCT_PLACEMENT' | 'TRENDS';

/**
 * Credit transaction types
 */
export type TransactionType = 'deduction' | 'addition' | 'refund' | 'allocation' | 'expiration';

/**
 * Credit transaction record
 */
export interface CreditTransaction {
    transactionId: string;
    userId: string;
    amount: number; // negative for deductions, positive for additions
    type: TransactionType;
    feature?: FeatureType;
    jobId?: string;
    trendId?: string;
    reason: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: Timestamp;
}

/**
 * User credits data stored in subscription
 */
export interface UserCredits {
    credits: number;
    initialCredits: number;
    creditsUsed: number;
    lastUpdated: Timestamp;
}

/**
 * Feature credit costs
 */
export const FEATURE_COSTS: Record<FeatureType, number> = {
    AI_INFLUENCER: 70,
    PRODUCT_SHOOTS: 50,
    PRODUCT_PLACEMENT: 30,
    TRENDS: 100, // Sky Fall trend
};

/**
 * Credit check result
 */
export interface CreditCheckResult {
    allowed: boolean;
    currentCredits: number;
    requiredCredits: number;
    error?: string;
}
