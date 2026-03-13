/**
 * Credits Service
 * 
 * Manages user credits for feature usage:
 * - Check credit balance
 * - Deduct credits for feature usage
 * - Add credits (subscriptions, refunds)
 * - Track credit transaction history
 */

import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    runTransaction,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';
import type {
    FeatureType,
    CreditTransaction,
    CreditCheckResult,
    TransactionType,
} from '../types/credits';
import { FEATURE_COSTS } from '../types/credits';

export type { CreditTransaction };

/**
 * Get user's current credit balance
 */
export async function getUserCredits(userId: string): Promise<number> {
    if (!userId) return 0;

    if (process.env.NEXT_PUBLIC_BYPASS_SUBSCRIPTION === 'true') {
        return 9999;
    }

    try {
        // Query the user's active subscription
        const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
        const q = query(
            subscriptionsRef,
            where('status', '==', 'active'),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return 0;
        }

        const subscriptionData = snapshot.docs[0].data();
        return subscriptionData.credits || 0;
    } catch (error) {
        console.error('Failed to get user credits:', error);
        return 0;
    }
}

/**
 * Check if user has sufficient credits for a feature
 */
export async function checkCredits(
    userId: string,
    feature: FeatureType,
    customCost?: number
): Promise<CreditCheckResult> {
    const requiredCredits = customCost || FEATURE_COSTS[feature];
    const currentCredits = await getUserCredits(userId);

    if (currentCredits >= requiredCredits) {
        return {
            allowed: true,
            currentCredits,
            requiredCredits,
        };
    }

    return {
        allowed: false,
        currentCredits,
        requiredCredits,
        error: `Insufficient credits. You have ${currentCredits} credits but need ${requiredCredits} credits for this feature.`,
    };
}

/**
 * Deduct credits from user's account
 * Uses Firestore transaction to prevent race conditions
 */
export async function deductCredits(
    userId: string,
    amount: number,
    feature: FeatureType,
    jobId: string,
    reason?: string
): Promise<boolean> {
    if (!userId || amount <= 0) {
        throw new Error('Invalid userId or amount');
    }

    if (process.env.NEXT_PUBLIC_BYPASS_SUBSCRIPTION === 'true') {
        console.log(`🛠️ CREDIT DEDUCTION BYPASS ENABLED: Skipping deduction of ${amount} for ${feature}`);
        return true;
    }

    try {
        const result = await runTransaction(db, async (transaction) => {
            // Get active subscription
            const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
            const q = query(
                subscriptionsRef,
                where('status', '==', 'active'),
                limit(1)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                throw new Error('No active subscription found');
            }

            const subscriptionDoc = snapshot.docs[0];
            const subscriptionData = subscriptionDoc.data();
            const currentCredits = subscriptionData.credits || 0;

            // Check if sufficient credits
            if (currentCredits < amount) {
                throw new Error(
                    `Insufficient credits. Current: ${currentCredits}, Required: ${amount}`
                );
            }

            const newCredits = currentCredits - amount;
            const creditsUsed = (subscriptionData.creditsUsed || 0) + amount;

            // Update subscription credits
            transaction.update(subscriptionDoc.ref, {
                credits: newCredits,
                creditsUsed: creditsUsed,
                lastUpdated: serverTimestamp(),
            });

            // Create transaction record
            const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const transactionRef = doc(
                collection(db, 'users', userId, 'creditTransactions'),
                transactionId
            );

            const creditTransaction: Omit<CreditTransaction, 'createdAt'> & { createdAt: any } = {
                transactionId,
                userId,
                amount: -amount,
                type: 'deduction',
                feature,
                jobId,
                reason: reason || `Credits deducted for ${feature}`,
                balanceBefore: currentCredits,
                balanceAfter: newCredits,
                createdAt: serverTimestamp(),
            };

            transaction.set(transactionRef, creditTransaction);

            return true;
        });

        console.log(`✅ Deducted ${amount} credits from user ${userId} for ${feature}`);
        return result;
    } catch (error) {
        console.error('Failed to deduct credits:', error);
        throw error;
    }
}

/**
 * Add credits to user's account (for subscriptions or refunds)
 */
export async function addCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    reason: string,
    jobId?: string,
    feature?: FeatureType
): Promise<void> {
    if (!userId || amount <= 0) {
        throw new Error('Invalid userId or amount');
    }

    if (process.env.NEXT_PUBLIC_BYPASS_SUBSCRIPTION === 'true') {
        console.log(`🛠️ CREDIT ADDITION BYPASS ENABLED: Skipping addition of ${amount} - ${reason}`);
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            // Get active subscription
            const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
            const q = query(
                subscriptionsRef,
                where('status', '==', 'active'),
                limit(1)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                throw new Error('No active subscription found');
            }

            const subscriptionDoc = snapshot.docs[0];
            const subscriptionData = subscriptionDoc.data();
            const currentCredits = subscriptionData.credits || 0;
            const newCredits = currentCredits + amount;

            // Update subscription credits
            const updateData: any = {
                credits: newCredits,
                lastUpdated: serverTimestamp(),
            };

            // If it's a refund, reduce creditsUsed
            if (type === 'refund') {
                const creditsUsed = Math.max(0, (subscriptionData.creditsUsed || 0) - amount);
                updateData.creditsUsed = creditsUsed;
            }

            transaction.update(subscriptionDoc.ref, updateData);

            // Create transaction record
            const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const transactionRef = doc(
                collection(db, 'users', userId, 'creditTransactions'),
                transactionId
            );

            const creditTransaction: Omit<CreditTransaction, 'createdAt'> & { createdAt: any } = {
                transactionId,
                userId,
                amount: amount,
                type,
                feature,
                jobId,
                reason,
                balanceBefore: currentCredits,
                balanceAfter: newCredits,
                createdAt: serverTimestamp(),
            };

            transaction.set(transactionRef, creditTransaction);
        });

        console.log(`✅ Added ${amount} credits to user ${userId} - ${reason}`);
    } catch (error) {
        console.error('Failed to add credits:', error);
        throw error;
    }
}

/**
 * Refund credits for a failed job
 */
export async function refundCredits(
    userId: string,
    amount: number,
    feature: FeatureType,
    jobId: string,
    reason: string
): Promise<void> {
    return addCredits(userId, amount, 'refund', reason, jobId, feature);
}

/**
 * Get credit transaction history for a user
 */
export async function getCreditHistory(
    userId: string,
    limitCount: number = 50
): Promise<CreditTransaction[]> {
    if (!userId) return [];

    try {
        const transactionsRef = collection(db, 'users', userId, 'creditTransactions');
        const q = query(transactionsRef, orderBy('createdAt', 'desc'), limit(limitCount));

        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => doc.data() as CreditTransaction);
    } catch (error) {
        console.error('Failed to get credit history:', error);
        return [];
    }
}

/**
 * Get feature cost
 */
export function getFeatureCost(feature: FeatureType, trendId?: string): number {
    // For trends, all trends cost the same for now (Sky Fall = 100)
    // Can be customized later based on trendId
    return FEATURE_COSTS[feature];
}

/**
 * Initialize credits for a new subscription
 * Called by Razorpay webhook when subscription is activated
 */
export async function initializeSubscriptionCredits(
    userId: string,
    subscriptionId: string,
    planType: 'hobby' | 'pro',
    initialCredits: number
): Promise<void> {
    if (!userId || !subscriptionId || initialCredits <= 0) {
        throw new Error('Invalid parameters for credit initialization');
    }

    try {
        const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscriptionId);

        await updateDoc(subscriptionRef, {
            credits: initialCredits,
            initialCredits: initialCredits,
            creditsUsed: 0,
            lastUpdated: serverTimestamp(),
        });

        // Create initial allocation transaction
        const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const transactionRef = doc(
            collection(db, 'users', userId, 'creditTransactions'),
            transactionId
        );

        const creditTransaction: Omit<CreditTransaction, 'createdAt'> & { createdAt: any } = {
            transactionId,
            userId,
            amount: initialCredits,
            type: 'allocation',
            reason: `Initial credits allocated for ${planType} plan subscription`,
            balanceBefore: 0,
            balanceAfter: initialCredits,
            createdAt: serverTimestamp(),
        };

        await setDoc(transactionRef, creditTransaction);

        console.log(
            `✅ Initialized ${initialCredits} credits for user ${userId} subscription ${subscriptionId}`
        );
    } catch (error) {
        console.error('Failed to initialize subscription credits:', error);
        throw error;
    }
}
