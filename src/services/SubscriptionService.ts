import { db } from '../config/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';

export type PlanType = 'starter' | 'pro' | 'max' | 'hobby' | 'enterprise';

export const SUBSCRIPTION_PLANS = {
    starter: {
        name: 'Starter',
        price: 2000, // display cents USD; legacy INR amounts retired
        currency: 'USD',
        period: 'monthly',
        interval: 1
    },
    // Legacy key kept for old Firestore docs until migrated
    hobby: {
        name: 'Hobby',
        price: 6000,
        currency: 'USD',
        period: 'monthly',
        interval: 1
    },
    pro: {
        name: 'Pro',
        price: 6000,
        currency: 'USD',
        period: 'monthly',
        interval: 1
    },
    max: {
        name: 'Max',
        price: 10000,
        currency: 'USD',
        period: 'monthly',
        interval: 1
    },
    enterprise: {
        name: 'Enterprise',
        price: 0,
        currency: 'USD',
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
    cancelAtCycleEnd?: boolean;
    willCancelAt?: Timestamp;
    pausedAt?: Timestamp;
    resumedAt?: Timestamp;
    expiresAt?: Timestamp | Date;
    completedAt?: Timestamp;
    haltedAt?: Timestamp;
    
    // Payment method tracking
    payment_method?: 'card' | 'netbanking' | 'upi' | 'emandate';
    last_payment_method?: string;
    payment_method_updated_at?: Timestamp;
    
    // Scheduled changes (Card/Netbanking)
    has_scheduled_changes?: boolean;
    change_scheduled_at?: Timestamp;
    scheduled_plan_id?: string;
    scheduled_plan_type?: PlanType;
    
    // UPI upgrade flow
    replacing_subscription_id?: string; // New sub replacing old
    being_replaced_by?: string; // Old sub being replaced
    will_activate_at?: Timestamp; // When new sub activates
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

function toDate(v: unknown): Date | undefined {
    if (!v) return undefined;
    if (v instanceof Date) return v;
    if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
        return (v as { toDate: () => Date }).toDate();
    }
    return undefined;
}

const LIVE_PLAN_STATUSES = new Set(['active', 'paused', 'authenticated', 'pending']);

/** users/{uid} is the only SoT — never the subscriptions subcollection. */
export async function getUserSubscription(userId: string): Promise<SubscriptionWithPlanDetails | null> {
    if (!userId) return null;

    try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (!snap.exists()) return null;
        const data = snap.data();
        const subscriptionId = typeof data.razorpaySubscriptionId === 'string' ? data.razorpaySubscriptionId : '';
        const planStatus = typeof data.planStatus === 'string' ? data.planStatus : '';
        if (!subscriptionId || !LIVE_PLAN_STATUSES.has(planStatus)) return null;

        const rawPlan = typeof data.plan === 'string' ? data.plan : 'starter';
        const planType = (rawPlan in SUBSCRIPTION_PLANS ? rawPlan : 'starter') as PlanType;
        const planDetails = SUBSCRIPTION_PLANS[planType];
        const period = data.billingCycle === 'yearly' ? 'annual' : 'monthly';

        return {
            userId,
            planType,
            subscriptionId,
            status: planStatus as SubscriptionData['status'],
            cancelAtCycleEnd: data.cancelAtPeriodEnd === true,
            has_scheduled_changes: data.hasScheduledChanges === true,
            scheduled_plan_type: data.scheduledPlanType,
            change_scheduled_at: data.scheduledChangeAt,
            payment_method: data.paymentMethod || data.payment_method,
            planDetails: {
                name: typeof data.planName === 'string' ? data.planName : planDetails.name,
                price: planDetails.price,
                currency: planDetails.currency,
                period,
                interval: 1,
            },
            nextBillingDate: toDate(data.currentPeriodEnd),
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
 * Get active subscription from users/{uid} (plan + billingCycle).
 */
export async function getActiveSubscription(userId: string): Promise<{ planType: 'starter' | 'pro' | 'max' | 'hobby'; billingCycle: 'monthly' | 'annual'; status: string } | null> {
    if (!userId) return null;

    try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (!snap.exists()) return null;
        const data = snap.data();
        if (data.planStatus !== 'active') return null;
        const raw = data.plan || 'starter';
        const planType =
            raw === 'pro' || raw === 'max' || raw === 'hobby' || raw === 'starter' ? raw : 'starter';
        return {
            planType,
            billingCycle: data.billingCycle === 'yearly' ? 'annual' : 'monthly',
            status: data.planStatus,
        };
    } catch (error) {
        console.error('Failed to fetch active subscription:', error);
        return null;
    }
}
