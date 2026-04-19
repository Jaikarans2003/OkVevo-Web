/**
 * Admin Service
 * 
 * Server-side only service for admin operations.
 * NEVER expose admin emails to the client.
 */

import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    deleteDoc,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    runTransaction,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import type {
    UserWithStats,
    UserStats,
    AdminAction,
    AdminActionType,
    CreditUpdateRequest,
} from '../types/admin';
import type { UserProfile } from './userService';

/**
 * Check if email is an admin (SERVER-SIDE ONLY)
 * Reads from ADMIN_EMAILS environment variable (not NEXT_PUBLIC_*)
 */
export function isAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    
    const adminEmails = process.env.ADMIN_EMAILS || '';
    const adminList = adminEmails.split(',').map(e => e.trim().toLowerCase());
    
    return adminList.includes(email.toLowerCase());
}

/**
 * Get all users with their stats (reads directly from subscriptions)
 */
export async function getAllUsers(): Promise<UserWithStats[]> {
    try {
        // Fetch all users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users: UserWithStats[] = [];

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data() as UserProfile;
            
            // Fetch active subscription directly
            const subscriptionsRef = collection(db, 'users', userDoc.id, 'subscriptions');
            const q = query(
                subscriptionsRef,
                where('status', '==', 'active'),
                limit(1)
            );
            const subSnapshot = await getDocs(q);
            
            let planType: 'hobby' | 'pro' | undefined;
            let subscriptionStatus: 'active' | 'cancelled' | 'paused' | 'completed' | 'pending' | undefined;
            let creditsAllocated = 0;
            let creditsSpent = 0;
            let creditsRemaining = 0;

            if (!subSnapshot.empty) {
                const subData = subSnapshot.docs[0].data();
                planType = subData.planType;
                subscriptionStatus = subData.status;
                creditsAllocated = subData.initialCredits || 0;
                creditsSpent = subData.creditsUsed || 0;
                creditsRemaining = subData.credits || 0;
            }

            users.push({
                uid: userDoc.id,
                email: userData.email,
                userType: (userData.userType as 'single' | 'organisation' | 'pro') || 'single',
                adminCredits: 0,
                planType,
                creditsAllocated,
                creditsSpent,
                creditsRemaining,
                lastActivity: undefined,
                createdAt: userData.createdAt?.toDate() || new Date(),
                subscriptionStatus,
            });
        }

        return users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
        console.error('Failed to fetch all users:', error);
        throw error;
    }
}

/**
 * Delete user and all associated data
 * Cascades to: subscriptions, creditTransactions, jobs, etc.
 */
export async function deleteUser(userId: string, adminEmail: string): Promise<void> {
    try {
        // Get user data before deletion for audit log
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            throw new Error('User not found');
        }
        const userData = userDoc.data() as UserProfile;

        // Delete user subcollections
        const subcollections = [
            'subscriptions',
            'creditTransactions',
            'aiInfluencerJobs',
            'productShootJobs',
            'trendJobs',
        ];

        for (const subcollection of subcollections) {
            const subCollectionRef = collection(db, 'users', userId, subcollection);
            const subDocs = await getDocs(subCollectionRef);
            
            for (const subDoc of subDocs.docs) {
                await deleteDoc(subDoc.ref);
            }
        }

        // Delete userStats
        await deleteDoc(doc(db, 'userStats', userId));

        // Delete user document
        await deleteDoc(doc(db, 'users', userId));

        // Log admin action
        await logAdminAction({
            adminEmail,
            action: 'delete_user',
            targetUserId: userId,
            targetUserEmail: userData.email,
            details: {
                userType: userData.userType,
                deletedAt: new Date().toISOString(),
            },
        });

        console.log(`✅ User ${userId} deleted by admin ${adminEmail}`);
    } catch (error) {
        console.error('Failed to delete user:', error);
        throw error;
    }
}

/**
 * Update user credits
 * Operations: add, deduct, set
 */
export async function updateUserCredits(
    request: CreditUpdateRequest,
    adminEmail: string
): Promise<void> {
    const { userId, operation, amount, reason } = request;

    if (amount < 0) {
        throw new Error('Amount must be positive');
    }

    try {
        // Fetch latest active subscription from users/{userId}/subscriptions
        // using updatedAt || createdAt fallback to avoid missing-timestamp query edge cases
        const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
        const snapshot = await getDocs(subscriptionsRef);

        if (snapshot.empty) {
            throw new Error('No subscription found for user');
        }

        const latestActiveDoc = snapshot.docs
            .filter((subDoc) => (subDoc.data().status || '') === 'active')
            .sort((a, b) => {
                const aData = a.data();
                const bData = b.data();
                const aMillis = aData.updatedAt?.toMillis?.() ?? aData.createdAt?.toMillis?.() ?? 0;
                const bMillis = bData.updatedAt?.toMillis?.() ?? bData.createdAt?.toMillis?.() ?? 0;
                return bMillis - aMillis;
            })[0];

        if (!latestActiveDoc) {
            throw new Error('No active subscription found for user');
        }

        const subscriptionDocRef = latestActiveDoc.ref;

        // Also get razorpaySubscriptions doc ref (for admin page sync)
        const razorpayRef = collection(db, 'razorpaySubscriptions');
        const razorpayQuery = query(razorpayRef, where('userId', '==', userId), limit(1));
        const razorpaySnap = await getDocs(razorpayQuery);
        const razorpayDocRef = !razorpaySnap.empty ? razorpaySnap.docs[0].ref : null;

        await runTransaction(db, async (transaction) => {
            // ALL READS FIRST — fetch latest remaining credits
            const subscriptionSnap = await transaction.get(subscriptionDocRef);
            const adminCreditsRef = doc(db, 'adminCreditAdjustments', userId);
            const adminCreditsSnap = await transaction.get(adminCreditsRef);

            if (!subscriptionSnap.exists()) {
                throw new Error('Subscription not found');
            }

            const subscriptionData = subscriptionSnap.data();
            // `credits` = remaining balance (decremented on each use), NOT initialCredits
            const currentCredits: number = subscriptionData.credits ?? 0;
            const creditsUsed: number = subscriptionData.creditsUsed ?? 0;

            // Calculate new credits based on latest values
            let newCredits: number;
            let newCreditsUsed = creditsUsed;

            switch (operation) {
                case 'add':
                    newCredits = currentCredits + amount;
                    break;
                case 'deduct':
                    newCredits = Math.max(0, currentCredits - amount);
                    newCreditsUsed = creditsUsed + amount;
                    break;
                case 'set':
                    newCredits = amount;
                    break;
                default:
                    throw new Error('Invalid operation');
            }

            // Get current admin credits
            const currentAdminCredits = adminCreditsSnap.exists() ? (adminCreditsSnap.data().totalAdjustment || 0) : 0;
            
            let adjustmentDelta = 0;
            if (operation === 'add') {
                adjustmentDelta = amount;
            } else if (operation === 'deduct') {
                adjustmentDelta = -amount;
            }

            // ALL WRITES AFTER READS
            // Update the subscription document with new credits
            transaction.update(subscriptionDocRef, {
                credits: newCredits,
                creditsUsed: newCreditsUsed,
                updatedAt: serverTimestamp(),
            });

            // Also update razorpaySubscriptions (for admin page display)
            if (razorpayDocRef) {
                transaction.update(razorpayDocRef, {
                    credits: newCredits,
                    creditsUsed: newCreditsUsed,
                    updatedAt: serverTimestamp(),
                });
            }

            // Keep userStats in sync
            const statsRef = doc(db, 'userStats', userId);
            transaction.set(statsRef, {
                creditsRemaining: newCredits,
                creditsSpent: newCreditsUsed,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // Create transaction record
            const transactionId = `admin-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const transactionRef = doc(
                collection(db, 'users', userId, 'creditTransactions'),
                transactionId
            );

            transaction.set(transactionRef, {
                transactionId,
                userId,
                amount: operation === 'deduct' ? -amount : amount,
                type: 'admin_adjustment',
                reason: `Admin ${operation}: ${reason}`,
                balanceBefore: currentCredits,
                balanceAfter: newCredits,
                adminEmail,
                createdAt: serverTimestamp(),
            });

            // Update admin credit adjustments tracking
            if (adjustmentDelta !== 0) {
                transaction.set(adminCreditsRef, {
                    userId,
                    totalAdjustment: currentAdminCredits + adjustmentDelta,
                    lastUpdated: serverTimestamp(),
                    lastAdminEmail: adminEmail,
                }, { merge: true });
            }
        });

        // Get user email for audit log
        let targetUserEmail = 'Unknown';
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                targetUserEmail = userDoc.data().email || 'Unknown';
            }
        } catch {}

        // Log admin action
        await logAdminAction({
            adminEmail,
            action: 'update_credits',
            targetUserId: userId,
            targetUserEmail,
            details: {
                operation,
                amount,
                reason,
            },
        });

        console.log(`✅ Credits updated for user ${userId} by admin ${adminEmail}`);
    } catch (error) {
        console.error('Failed to update user credits:', error);
        throw error;
    }
}

/**
 * Log admin action to audit trail
 */
export async function logAdminAction(params: {
    adminEmail: string;
    action: AdminActionType;
    targetUserId?: string;
    targetUserEmail?: string;
    details: any;
}): Promise<void> {
    try {
        const actionId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const actionRef = doc(db, 'adminAuditLogs', actionId);

        const auditLog: Omit<AdminAction, 'timestamp'> & { timestamp: any } = {
            id: actionId,
            adminEmail: params.adminEmail,
            action: params.action,
            targetUserId: params.targetUserId,
            targetUserEmail: params.targetUserEmail,
            details: params.details,
            timestamp: serverTimestamp(),
        };

        await setDoc(actionRef, auditLog);
    } catch (error) {
        console.error('Failed to log admin action:', error);
        // Don't throw - audit logging failure shouldn't block admin actions
    }
}

/**
 * Get recent audit logs
 */
export async function getAuditLogs(limitCount: number = 100): Promise<AdminAction[]> {
    try {
        const logsRef = collection(db, 'adminAuditLogs');
        const q = query(
            logsRef,
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as AdminAction);
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        throw error;
    }
}

/**
 * Update userStats for a user (called by Cloud Functions on subscription/credit changes)
 */
export async function updateUserStats(userId: string): Promise<void> {
    try {
        // Get user data
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            throw new Error('User not found');
        }
        const userData = userDoc.data() as UserProfile;

        // Get active subscription
        const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
        const q = query(
            subscriptionsRef,
            where('status', '==', 'active'),
            limit(1)
        );

        const snapshot = await getDocs(q);
        
        let stats: Partial<UserStats> = {
            uid: userId,
            email: userData.email,
            creditsAllocated: 0,
            creditsSpent: 0,
            creditsRemaining: 0,
            updatedAt: Timestamp.now(),
        };

        if (!snapshot.empty) {
            const subscriptionData = snapshot.docs[0].data();
            stats = {
                ...stats,
                planType: subscriptionData.planType,
                subscriptionStatus: subscriptionData.status,
                creditsAllocated: subscriptionData.initialCredits || 0,
                creditsSpent: subscriptionData.creditsUsed || 0,
                creditsRemaining: subscriptionData.credits || 0,
            };
        }

        // Update userStats document
        const statsRef = doc(db, 'userStats', userId);
        await setDoc(statsRef, stats, { merge: true });

        console.log(`✅ UserStats updated for ${userId}`);
    } catch (error) {
        console.error('Failed to update user stats:', error);
        throw error;
    }
}
