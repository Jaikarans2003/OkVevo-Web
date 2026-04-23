import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

export type PlanType = 'hobby' | 'pro' | 'enterprise';

export const SUBSCRIPTION_PLANS = {
    hobby: {
        name: 'Hobby',
        price: 599900,
        currency: 'INR',
        period: 'monthly',
        interval: 1
    },
    pro: {
        name: 'Pro',
        price: 1799900,
        currency: 'INR',
        period: 'monthly',
        interval: 1
    },
    enterprise: {
        name: 'Enterprise',
        price: 0,
        currency: 'INR',
        period: 'custom',
        interval: 1
    }
};

export interface SubscriptionData {
    userId: string;
    planType: PlanType;
    subscriptionId: string;
    paymentId?: string;
    status: 'active' | 'cancelled' | 'paused' | 'completed' | 'pending' | 'halted' | 'authenticated';
    credits?: number;
    initialCredits?: number;
    creditsUsed?: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    activatedAt?: Timestamp;
    lastPaymentId?: string;
    lastPaymentAmount?: number;
    lastPaymentDate?: Timestamp;
    gracePeriodEndsAt?: Timestamp;
    lastPaymentFailure?: {
        paymentId: string;
        errorCode: string;
        errorDescription: string;
        failedAt: Timestamp;
    };
    cancelledAt?: Timestamp;
    pausedAt?: Timestamp;
    resumedAt?: Timestamp;
    expiresAt?: Timestamp | Date;
    completedAt?: Timestamp;
    haltedAt?: Timestamp;
}

export interface SubscriptionWithPlanDetails extends SubscriptionData {
    planDetails: {
        name: string;
        price: number;
        currency: string;
        period: string;
        interval: number;
    };
    nextBillingDate?: Date;
}

/**
 * Fetch user's subscription from Firestore
 * Queries from users/{userId}/subscriptions subcollection
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionWithPlanDetails | null> {
    if (!userId) return null;

    if (process.env.NEXT_PUBLIC_BYPASS_SUBSCRIPTION === 'false') {
        return {
            userId,
            planType: 'pro',
            subscriptionId: 'mock-sub-id',
            status: 'active',
            credits: 9999,
            initialCredits: 9999,
            creditsUsed: 0,
            planDetails: {
                name: 'Pro (Mock)',
                price: 0,
                currency: 'INR',
                period: 'monthly',
                interval: 1,
            },
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };
    }

    try {
        // Query the user's active or completed (annual) subscription
        const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
        const q = query(
            subscriptionsRef,
            where('status', 'in', ['active', 'completed']),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const data = snapshot.docs[0].data() as SubscriptionData;

        // If completed, only valid if expiresAt is in the future (annual plans)
        if (data.status === 'completed') {
            if (!data.expiresAt) return null;
            const expiry = data.expiresAt instanceof Date ? data.expiresAt : (data.expiresAt as any).toDate();
            if (expiry < new Date()) return null;
        }
        const planDetails = SUBSCRIPTION_PLANS[data.planType];

        // Calculate next billing date (approximate - 1 month from last payment or creation)
        let nextBillingDate: Date | undefined;
        if (data.lastPaymentDate) {
            nextBillingDate = new Date(data.lastPaymentDate.toDate());
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        } else if (data.activatedAt) {
            nextBillingDate = new Date(data.activatedAt.toDate());
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        } else if (data.createdAt) {
            nextBillingDate = new Date(data.createdAt.toDate());
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }

        return {
            ...data,
            planDetails: {
                name: planDetails.name,
                price: planDetails.price,
                currency: planDetails.currency,
                period: planDetails.period,
                interval: planDetails.interval,
            },
            nextBillingDate,
            credits: data.credits || 0,
            initialCredits: data.initialCredits || 0,
            creditsUsed: data.creditsUsed || 0,
        };
    } catch (error) {
        console.error('Failed to fetch subscription:', error);
        throw error;
    }
}

/**
 * Format price from paise to rupees
 */
export function formatPrice(priceInPaise: number): string {
    return `₹${(priceInPaise / 100).toFixed(2)}`;
}

/**
 * Get status color for subscription
 */
export function getStatusColor(status: string): string {
    switch (status) {
        case 'active':
            return 'bg-green-500';
        case 'authenticated':
            return 'bg-blue-400';
        case 'pending':
            return 'bg-yellow-500';
        case 'halted':
            return 'bg-orange-500';
        case 'cancelled':
            return 'bg-red-500';
        case 'paused':
            return 'bg-yellow-600';
        case 'completed':
            return 'bg-blue-500';
        default:
            return 'bg-gray-500';
    }
}

/**
 * Get status label for subscription
 */
export function getStatusLabel(status: string): string {
    switch (status) {
        case 'active':
            return 'Active';
        case 'authenticated':
            return 'Authenticated';
        case 'pending':
            return 'Pending';
        case 'halted':
            return 'Halted';
        case 'cancelled':
            return 'Cancelled';
        case 'paused':
            return 'Paused';
        case 'completed':
            return 'Completed';
        default:
            return 'Unknown';
    }
}

/**
 * Get active subscription with billing period from razorpaySubscriptions collection
 */
export async function getActiveSubscription(userId: string): Promise<{ planType: 'hobby' | 'pro'; billingCycle: 'monthly' | 'annual'; status: string } | null> {
    if (!userId) return null;

    try {
        // Query razorpaySubscriptions collection for active subscription
        const subscriptionsRef = collection(db, 'razorpaySubscriptions');
        const q = query(
            subscriptionsRef,
            where('userId', '==', userId),
            where('status', '==', 'active'),
            orderBy('updatedAt', 'desc'),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const data = snapshot.docs[0].data();
        
        return {
            planType: data.planType || 'hobby',
            billingCycle: data.billingPeriod || 'monthly',
            status: data.status || 'active'
        };
    } catch (error) {
        console.error('Failed to fetch active subscription:', error);
        return null;
    }
}
