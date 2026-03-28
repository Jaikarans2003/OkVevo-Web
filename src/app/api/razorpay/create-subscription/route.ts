import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { RAZORPAY_CONFIG, getPlanDetails, getRazorpayPlanId, type PlanType } from '@/config/razorpay';

/**
 * Create Razorpay Subscription
 * POST /api/razorpay/create-subscription
 * 
 * Flow:
 * 1. Validate user and plan type
 * 2. Create Razorpay subscription
 * 3. Return subscription ID and checkout URL
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { planType, userId, userEmail, userName } = body;

        // Validate inputs
        if (!planType || !userId) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: planType, userId' },
                { status: 400 }
            );
        }

        if (planType !== 'hobby' && planType !== 'pro') {
            return NextResponse.json(
                { success: false, error: 'Invalid plan type. Must be "hobby" or "pro"' },
                { status: 400 }
            );
        }

        // Initialize Razorpay instance
        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const planDetails = getPlanDetails(planType as PlanType);
        const razorpayPlanId = getRazorpayPlanId(planType as PlanType);

        console.log(`📦 Creating subscription for user ${userId}, plan: ${planType}`);

        // Create subscription
        const subscription = await razorpay.subscriptions.create({
            plan_id: razorpayPlanId,
            total_count: 12, // 12 months (1 year)
            quantity: 1,
            customer_notify: 1,
            notes: {
                userId,
                planType,
                userEmail: userEmail || '',
                userName: userName || '',
            },
        });

        console.log(`✅ Subscription created: ${subscription.id}`);

        return NextResponse.json({
            success: true,
            subscriptionId: subscription.id,
            planId: razorpayPlanId,
            amount: planDetails.price,
            currency: planDetails.currency,
            razorpayKeyId: RAZORPAY_CONFIG.keyId,
            shortUrl: subscription.short_url,
        });

    } catch (error: any) {
        console.error('❌ Subscription creation error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to create subscription',
            },
            { status: 500 }
        );
    }
}
