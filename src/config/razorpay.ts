/**
 * Razorpay Configuration
 * Handles recurring subscription payments
 */

export const RAZORPAY_CONFIG = {
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SNpzXM7zRova23',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'OjFT4dZzpUTZMu0Loyw1DxZn',
};

export const SUBSCRIPTION_PLANS = {
    hobby: {
        planId: 'plan_SNpxmbrt70Tq44',
        name: 'Hobby Plan',
        price: 4999, // in paise (₹49.99)
        currency: 'INR',
        period: 'monthly',
        interval: 1,
    },
    pro: {
        planId: 'plan_SO0vfKLWrlc5Wh',
        name: 'Pro Plan',
        price: 13999, // in paise (₹139.99) - managed by Razorpay
        currency: 'INR',
        period: 'monthly',
        interval: 1,
    },
} as const;

export type PlanType = keyof typeof SUBSCRIPTION_PLANS;
