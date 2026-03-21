import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { SUBSCRIPTION_PLANS, PlanType } from '../config/razorpay';

export interface SubscriptionData {
    userId: string;
    planType: PlanType;
    subscriptionId: string;
    paymentId?: string;
    status: 'active' | 'cancelled' | 'paused' | 'completed' | 'pending';
    credits?: number;
    initialCredits?: number;
    creditsUsed?: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    activatedAt?: Timestamp;
    lastPaymentId?: string;
    lastPaymentAmount?: number;
    lastPaymentDate?: Timestamp;
    cancelledAt?: Timestamp;
    pausedAt?: Timestamp;
    resumedAt?: Timestamp;
    completedAt?: Timestamp;
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
        // Query the user's active subscription from subcollection
        const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
        const q = query(
            subscriptionsRef,
            where('status', '==', 'active'),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const data = snapshot.docs[0].data() as SubscriptionData;
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
        case 'cancelled':
            return 'bg-red-500';
        case 'paused':
            return 'bg-yellow-500';
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
