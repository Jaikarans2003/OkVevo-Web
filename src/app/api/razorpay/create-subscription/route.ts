import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { RAZORPAY_CONFIG, SUBSCRIPTION_PLANS, PlanType } from '@/config/razorpay';

/**
 * Create Razorpay Subscription
 * POST /api/razorpay/create-subscription
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { planType, userId, userEmail, userName } = body;

        if (!planType || !userId || !userEmail) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: planType, userId, userEmail' },
                { status: 400 }
            );
        }

        const plan = SUBSCRIPTION_PLANS[planType as PlanType];
        if (!plan) {
            return NextResponse.json(
                { success: false, error: 'Invalid plan type' },
                { status: 400 }
            );
        }

        // Initialize Razorpay instance
        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        // Create subscription
        const subscription = await razorpay.subscriptions.create({
            plan_id: plan.planId,
            customer_notify: 1,
            total_count: 12, // 12 months
            notes: {
                userId,
                userEmail,
                planType,
            },
        });

        console.log('✅ Razorpay subscription created:', subscription.id);

        return NextResponse.json({
            success: true,
            subscriptionId: subscription.id,
            planId: plan.planId,
            amount: plan.price,
            currency: plan.currency,
            razorpayKeyId: RAZORPAY_CONFIG.keyId,
            userEmail,
            userName: userName || userEmail,
        });

    } catch (error) {
        console.error('❌ Razorpay subscription creation error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create subscription',
            },
            { status: 500 }
        );
    }
}
