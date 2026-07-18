/**
 * Razorpay Configuration
 * Manages Razorpay credentials and subscription plan configurations
 */

import { env } from '@/config/env';

export const RAZORPAY_CONFIG = {
    keyId: env.razorpay.keyId,
    keySecret: env.razorpay.keySecret,
};

export type PlanType = 'starter' | 'hobby' | 'pro' | 'enterprise';

/**
 * Razorpay Subscription Plan IDs
 * These must be created in the Razorpay Dashboard first
 * Format: plan_XXXXXXXXXXXXX
 */
export const RAZORPAY_PLAN_IDS = {
    starter: {
        monthly: env.razorpay.plans.starterMonthly,
        annual: env.razorpay.plans.starterAnnual,
    },
    hobby: {
        monthly: env.razorpay.plans.hobbyMonthly,
        annual: env.razorpay.plans.hobbyAnnual,
    },
    pro: {
        monthly: env.razorpay.plans.proMonthly,
        annual: env.razorpay.plans.proAnnual,
    },
};

/**
 * Subscription Plan Details
 */
export const SUBSCRIPTION_PLANS = {
    starter: {
        name: 'Starter',
        monthly: {
            price: 149900, // ₹1,499 in paise
            currency: 'INR',
            period: 'monthly',
            interval: 1,
        },
        annual: {
            price: 127415, // ₹1,274.15 in paise
            currency: 'INR',
            period: 'annual',
            interval: 12,
        },
        credits: 1400, // 10 videos or 10 min generation
    },
    hobby: {
        name: 'Hobby',
        monthly: {
            price: 599900, // ₹5,999 in paise
            currency: 'INR',
            period: 'monthly',
            interval: 1,
        },
        annual: {
            price: 509900, // ₹5,099 in paise (annual monthly equivalent)
            currency: 'INR',
            period: 'annual',
            interval: 12,
        },
        credits: 10000, // Initial credits for hobby plan (50 videos or 30 min generation)
    },
    pro: {
        name: 'Pro',
        monthly: {
            price: 1799900, // ₹17,999 in paise
            currency: 'INR',
            period: 'monthly',
            interval: 1,
        },
        annual: {
            price: 1529900, // ₹15,299 in paise (annual monthly equivalent)
            currency: 'INR',
            period: 'annual',
            interval: 12,
        },
        credits: 36000, // Initial credits for pro plan (180 videos or 105 min generation)
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
 * Get Razorpay plan ID by plan type and billing period
 */
export function getRazorpayPlanId(planType: PlanType, billingPeriod: 'monthly' | 'annual' = 'monthly'): string {
    if (planType === 'starter') return RAZORPAY_PLAN_IDS.starter[billingPeriod];
    if (planType === 'hobby') return RAZORPAY_PLAN_IDS.hobby[billingPeriod];
    if (planType === 'pro') return RAZORPAY_PLAN_IDS.pro[billingPeriod];
    throw new Error(`No Razorpay plan ID configured for ${planType}`);
}

/**
 * Get plan details by plan type and billing period
 */
export function getPlanDetailsByPeriod(planType: PlanType, billingPeriod: 'monthly' | 'annual' = 'monthly') {
    const plan = SUBSCRIPTION_PLANS[planType];
    
    // Enterprise plan doesn't have monthly/annual variants
    if (planType === 'enterprise') {
        const enterprisePlan = plan as typeof SUBSCRIPTION_PLANS.enterprise;
        return {
            name: enterprisePlan.name,
            price: enterprisePlan.price,
            currency: enterprisePlan.currency,
            period: enterprisePlan.period,
            interval: enterprisePlan.interval,
            credits: enterprisePlan.credits,
        };
    }
    
    return {
        name: plan.name,
        ...(plan as any)[billingPeriod],
        credits: plan.credits,
    };
}
