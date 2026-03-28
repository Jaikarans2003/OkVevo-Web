/**
 * Razorpay Configuration
 * Manages Razorpay credentials and subscription plan configurations
 */

export const RAZORPAY_CONFIG = {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
};

export type PlanType = 'hobby' | 'pro' | 'enterprise';

/**
 * Razorpay Subscription Plan IDs
 * These must be created in the Razorpay Dashboard first
 * Format: plan_XXXXXXXXXXXXX
 */
export const RAZORPAY_PLAN_IDS = {
    hobby: process.env.RAZORPAY_HOBBY_PLAN_ID || 'plan_hobby_monthly',
    pro: process.env.RAZORPAY_PRO_PLAN_ID || 'plan_pro_monthly',
};

/**
 * Subscription Plan Details
 */
export const SUBSCRIPTION_PLANS = {
    hobby: {
        name: 'Hobby',
        price: 499900, // ₹4,999 in paise
        currency: 'INR',
        period: 'monthly',
        interval: 1,
        credits: 10000, // Initial credits for hobby plan (50 videos or 30 min generation)
    },
    pro: {
        name: 'Pro',
        price: 1399900, // ₹13,999 in paise
        currency: 'INR',
        period: 'monthly',
        interval: 1,
        credits: 40000, // Initial credits for pro plan (180 videos or 105 min generation)
    },
    enterprise: {
        name: 'Enterprise',
        price: 0,
        currency: 'INR',
        period: 'custom',
        interval: 1,
        credits: 0,
    }
};

/**
 * Get plan details by plan type
 */
export function getPlanDetails(planType: PlanType) {
    return SUBSCRIPTION_PLANS[planType];
}

/**
 * Get Razorpay plan ID by plan type
 */
export function getRazorpayPlanId(planType: PlanType): string {
    if (planType === 'hobby') return RAZORPAY_PLAN_IDS.hobby;
    if (planType === 'pro') return RAZORPAY_PLAN_IDS.pro;
    throw new Error(`No Razorpay plan ID configured for ${planType}`);
}
