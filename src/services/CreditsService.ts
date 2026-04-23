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
import { getUserProfile } from './userService';

export type { CreditTransaction };

/**
 * Check if subscription is valid (active or within grace period)
 */
function isSubscriptionValid(subscriptionData: any): boolean {
    const status = subscriptionData.status;
    
    // Active subscription is always valid
    if (status === 'active') {
        return true;
    }
    
    // Completed annual subscription — valid until expiresAt
    if (status === 'completed') {
        const expiresAt = subscriptionData.expiresAt;
        if (!expiresAt) return false;
        const expiry = expiresAt instanceof Date ? expiresAt : expiresAt.toDate();
        return new Date() < expiry;
    }
    
    // Pending or authenticated - check grace period
    if (status === 'pending' || status === 'authenticated') {
        const gracePeriodEndsAt = subscriptionData.gracePeriodEndsAt;
        
        if (gracePeriodEndsAt) {
            const now = new Date();
            const gracePeriodEnd = gracePeriodEndsAt.toDate();
            return now < gracePeriodEnd;
        }
        
        // No grace period set - allow for now
        return true;
    }
    
    // Any other status (halted, cancelled, etc.) is invalid
    return false;
}

/**
 * Get credits from a Pro Team shared pool.
 * If the pool was never seeded (field missing), lazily seeds it from the admin's subscription.
 */
async function getProOrgCredits(proOrgId: string): Promise<number> {
    const proOrgRef = doc(db, 'proOrganisations', proOrgId);
    const proOrgSnap = await getDoc(proOrgRef);
    if (!proOrgSnap.exists()) return 0;

    const data = proOrgSnap.data();

    // Pool already initialised — return current balance
    if (data.credits !== undefined) {
        return data.credits as number;
    }

    // Pool has never been seeded (org created before credits pool feature).
    // Bootstrap it from the admin's active subscription.
    try {
        const adminUid: string | undefined = data.adminUid;
        if (!adminUid) return 0;

        const subsRef = collection(db, 'users', adminUid, 'subscriptions');
        const subsQ = query(
            subsRef,
            where('status', 'in', ['active', 'authenticated', 'pending']),
            limit(1)
        );
        const subsSnap = await getDocs(subsQ);
        const seedCredits: number = subsSnap.empty ? 0 : (subsSnap.docs[0].data().credits ?? 0);

        await updateDoc(proOrgRef, {
            credits: seedCredits,
            initialCredits: seedCredits,
            creditsUsed: 0,
            lastUpdated: serverTimestamp(),
        });

        console.log(`🌱 Pro Team pool seeded: ${proOrgId} → ${seedCredits} credits`);
        return seedCredits;
    } catch (e) {
        console.error('Failed to seed Pro Team pool:', e);
        return 0;
    }
}

/**
 * Deduct credits from a Pro Team shared pool (Firestore transaction)
 */
async function deductFromProPool(
    userId: string,
    proOrgId: string,
    amount: number,
    feature: FeatureType,
    jobId: string,
    reason?: string
): Promise<boolean> {
    const proOrgRef = doc(db, 'proOrganisations', proOrgId);

    return await runTransaction(db, async (transaction) => {
        const proOrgSnap = await transaction.get(proOrgRef);
        if (!proOrgSnap.exists()) throw new Error('Pro Team not found');

        const data = proOrgSnap.data();
        const currentCredits: number = data.credits ?? 0;

        if (currentCredits < amount) {
            throw new Error(
                `Insufficient credits. Team has ${currentCredits} credits but needs ${amount} credits.`
            );
        }

        const newCredits = currentCredits - amount;
        const creditsUsed = (data.creditsUsed ?? 0) + amount;

        transaction.update(proOrgRef, {
            credits: newCredits,
            creditsUsed,
            lastUpdated: serverTimestamp(),
        });

        const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const transactionRef = doc(
            collection(db, 'users', userId, 'creditTransactions'),
            transactionId
        );
        transaction.set(transactionRef, {
            transactionId,
            userId,
            proOrgId,
            amount: -amount,
            type: 'deduction',
            feature,
            jobId,
            reason: reason || `Pro Team credits deducted for ${feature}`,
            balanceBefore: currentCredits,
            balanceAfter: newCredits,
            createdAt: serverTimestamp(),
        });

        return true;
    });
}

/**
 * Refund credits to a Pro Team shared pool
 */
async function refundToProPool(
    userId: string,
    proOrgId: string,
    amount: number,
    feature: FeatureType,
    jobId: string,
    reason: string
): Promise<void> {
    const proOrgRef = doc(db, 'proOrganisations', proOrgId);

    await runTransaction(db, async (transaction) => {
        const proOrgSnap = await transaction.get(proOrgRef);
        if (!proOrgSnap.exists()) throw new Error('Pro Team not found');

        const data = proOrgSnap.data();
        const currentCredits: number = data.credits ?? 0;
        const newCredits = currentCredits + amount;
        const creditsUsed = Math.max(0, (data.creditsUsed ?? 0) - amount);

        transaction.update(proOrgRef, {
            credits: newCredits,
            creditsUsed,
            lastUpdated: serverTimestamp(),
        });

        const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const transactionRef = doc(
            collection(db, 'users', userId, 'creditTransactions'),
            transactionId
        );
        transaction.set(transactionRef, {
            transactionId,
            userId,
            proOrgId,
            amount,
            type: 'refund',
            feature,
            jobId,
            reason,
            balanceBefore: currentCredits,
            balanceAfter: newCredits,
            createdAt: serverTimestamp(),
        });
    });
}

/**
 * Get user's current credit balance
 * For Pro Team members, reads from the shared team pool.
 */
export async function getUserCredits(userId: string): Promise<number> {
    if (!userId) return 0;

    if (process.env.NEXT_PUBLIC_BYPASS_SUBSCRIPTION === 'true') {
        return 9999;
    }

    try {
        // Pro Team members share a pool — check that first
        const userProfile = await getUserProfile(userId);
        if (userProfile?.proOrganisationId) {
            return await getProOrgCredits(userProfile.proOrganisationId);
        }

        // Individual subscription credits
        const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
        const q = query(
            subscriptionsRef,
            where('status', 'in', ['active', 'completed', 'pending', 'authenticated']),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return 0;
        }

        const subscriptionData = snapshot.docs[0].data();
        
        // Check if subscription is valid (considering grace period)
        if (!isSubscriptionValid(subscriptionData)) {
            return 0;
        }
        
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
 * Deduct credits from user's account (or shared Pro Team pool)
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

    // Pro Team members deduct from the shared pool
    const userProfile = await getUserProfile(userId);
    if (userProfile?.proOrganisationId) {
        const result = await deductFromProPool(
            userId,
            userProfile.proOrganisationId,
            amount,
            feature,
            jobId,
            reason
        );
        console.log(`✅ Deducted ${amount} credits from Pro Team pool ${userProfile.proOrganisationId} for user ${userId}`);
        return result;
    }

    try {
        const result = await runTransaction(db, async (transaction) => {
            // Get active or pending subscription
            const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
            const q = query(
                subscriptionsRef,
                where('status', 'in', ['active', 'pending', 'authenticated']),
                limit(1)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                throw new Error('No active subscription found');
            }

            const subscriptionDoc = snapshot.docs[0];
            const subscriptionData = subscriptionDoc.data();
            
            // Check if subscription is valid (considering grace period)
            if (!isSubscriptionValid(subscriptionData)) {
                throw new Error('Subscription is inactive or grace period has expired');
            }
            
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
            // Get active or pending subscription
            const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
            const q = query(
                subscriptionsRef,
                where('status', 'in', ['active', 'pending', 'authenticated']),
                limit(1)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                throw new Error('No active subscription found');
            }

            const subscriptionDoc = snapshot.docs[0];
            const subscriptionData = subscriptionDoc.data();
            
            // Check if subscription is valid (considering grace period)
            if (!isSubscriptionValid(subscriptionData)) {
                throw new Error('Subscription is inactive or grace period has expired');
            }
            
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
 * Refund credits for a failed job (or shared Pro Team pool)
 */
export async function refundCredits(
    userId: string,
    amount: number,
    feature: FeatureType,
    jobId: string,
    reason: string
): Promise<void> {
    const userProfile = await getUserProfile(userId);
    if (userProfile?.proOrganisationId) {
        return refundToProPool(userId, userProfile.proOrganisationId, amount, feature, jobId, reason);
    }
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
