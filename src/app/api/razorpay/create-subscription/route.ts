import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { RAZORPAY_CONFIG, getPlanDetailsByPeriod, getRazorpayPlanId, type PlanType } from '@/config/razorpay';

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
        const { planType, userId, userEmail, userName, billingPeriod = 'monthly', couponCode } = body;

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

        if (billingPeriod !== 'monthly' && billingPeriod !== 'annual') {
            return NextResponse.json(
                { success: false, error: 'Invalid billing period. Must be "monthly" or "annual"' },
                { status: 400 }
            );
        }

        // Initialize Razorpay instance
        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const planDetails = getPlanDetailsByPeriod(planType as PlanType, billingPeriod as 'monthly' | 'annual');
        const razorpayPlanId = getRazorpayPlanId(planType as PlanType, billingPeriod as 'monthly' | 'annual');

        console.log(`📦 Creating ${billingPeriod} subscription for user ${userId}, plan: ${planType}`);

        // Apply Razorpay Offer for affiliate referral codes on monthly plans
        const affiliateOfferId = process.env.RAZORPAY_AFFILIATE_OFFER_ID || '';
        const shouldApplyOffer = couponCode?.valid && couponCode.type === 'affiliate' && couponCode.discountAmount > 0 && affiliateOfferId;

        if (shouldApplyOffer) {
            console.log(`💰 Applying Razorpay Offer: ${affiliateOfferId} (₹${couponCode.discountAmount / 100} off first month)`);
        }

        // Create subscription
        const subscription = await razorpay.subscriptions.create({
            plan_id: razorpayPlanId,
            total_count: billingPeriod === 'annual' ? 1 : 12, // 1 year for annual, 12 months for monthly
            quantity: 1,
            customer_notify: 1,
            ...(shouldApplyOffer && { offer_id: affiliateOfferId }),
            notes: {
                userId,
                planType,
                billingPeriod,
                userEmail: userEmail || '',
                userName: userName || '',
                ...(couponCode?.valid && {
                    couponApplied: 'true',
                    couponCode: couponCode.couponCode || '',
                    couponType: couponCode.type || '',
                    discountAmount: couponCode.discountAmount?.toString() || '0',
                    affiliateId: couponCode.affiliateId || '',
                }),
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
