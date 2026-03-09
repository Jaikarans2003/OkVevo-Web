import { db } from '../config/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { SUBSCRIPTION_PLANS, PlanType } from '../config/razorpay';

export interface SubscriptionData {
    userId: string;
    planType: PlanType;
    subscriptionId: string;
    paymentId?: string;
    status: 'active' | 'cancelled' | 'paused' | 'completed' | 'pending';
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
 * 
 * ⚠️ TESTING MODE: Bypassing payment checks - all users have active premium subscription
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionWithPlanDetails | null> {
    if (!userId) return null;

    // 🔓 BYPASS FOR TESTING: Return mock active subscription for all users
    const mockSubscription: SubscriptionWithPlanDetails = {
        userId,
        planType: 'pro',
        subscriptionId: 'test_subscription_bypass',
        status: 'active',
        planDetails: {
            name: SUBSCRIPTION_PLANS.pro.name,
            price: SUBSCRIPTION_PLANS.pro.price,
            currency: SUBSCRIPTION_PLANS.pro.currency,
            period: SUBSCRIPTION_PLANS.pro.period,
            interval: SUBSCRIPTION_PLANS.pro.interval,
        },
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };
    
    console.log('🔓 TESTING MODE: Bypassing subscription check for user:', userId);
    return mockSubscription;

    // /* ORIGINAL CODE - COMMENTED OUT FOR TESTING
    // try {
    //     const docRef = doc(db, 'subscriptions', userId);
    //     const docSnap = await getDoc(docRef);

    //     if (!docSnap.exists()) {
    //         return null;
    //     }

    //     const data = docSnap.data() as SubscriptionData;
    //     const planDetails = SUBSCRIPTION_PLANS[data.planType];

        // Calculate next billing date (approximate - 1 month from last payment or creation)
    //     let nextBillingDate: Date | undefined;
    //     if (data.lastPaymentDate) {
    //         nextBillingDate = new Date(data.lastPaymentDate.toDate());
    //         nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    //     } else if (data.activatedAt) {
    //         nextBillingDate = new Date(data.activatedAt.toDate());
    //         nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    //     } else if (data.createdAt) {
    //         nextBillingDate = new Date(data.createdAt.toDate());
    //         nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    //     }

    //     return {
    //         ...data,
    //         planDetails: {
    //             name: planDetails.name,
    //             price: planDetails.price,
    //             currency: planDetails.currency,
    //             period: planDetails.period,
    //             interval: planDetails.interval,
    //         },
    //         nextBillingDate,
    //     };
    // } catch (error) {
    //     console.error('Failed to fetch subscription:', error);
    //     throw error;
    // }
    
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
