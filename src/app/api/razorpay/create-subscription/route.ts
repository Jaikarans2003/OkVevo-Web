import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import {
    RAZORPAY_CONFIG,
    getPlanDetailsByPeriod,
    getRazorpayPlanId,
    isSelfServePlanType,
    type BillingPeriod,
    type SelfServePlanType,
} from '@/config/razorpay';

/**
 * Create Razorpay Subscription
 * POST /api/razorpay/create-subscription
 * 
 * Flow:
 * 1. Validate user and plan type
 * 2. Check for existing active subscriptions (auto-detect upgrade flow)
 * 3. Create Razorpay subscription
 * 4. Return subscription ID and checkout URL
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

        if (!isSelfServePlanType(planType)) {
            return NextResponse.json(
                { success: false, error: 'Invalid plan type. Must be "starter", "pro", or "max"' },
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

        const planDetails = getPlanDetailsByPeriod(
            planType as SelfServePlanType,
            billingPeriod as BillingPeriod
        );
        const razorpayPlanId = getRazorpayPlanId(
            planType as SelfServePlanType,
            billingPeriod as BillingPeriod
        );

        // Check for existing active subscriptions (auto-detect upgrade/downgrade flow)
        let existingSubscription = null;
        let isUpgradeFlow = false;
        
        try {
            const subscriptionsSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('subscriptions')
                .where('status', '==', 'active')
                .limit(1)
                .get();
            
            if (!subscriptionsSnapshot.empty) {
                existingSubscription = subscriptionsSnapshot.docs[0].data();
                const existingSubId = existingSubscription.subscriptionId;
                
                // Check if user is changing plans (upgrade/downgrade)
                if (existingSubscription.planType !== planType) {
                    isUpgradeFlow = true;
                    console.log(`🔄 Upgrade/Downgrade detected: ${existingSubscription.planType} → ${planType}`);
                    console.log(`   Existing subscription: ${existingSubId}`);
                    console.log(`   This will be marked as upgrade flow`);
                }
            }
        } catch (error) {
            console.error('⚠️ Error checking existing subscriptions:', error);
            // Continue with subscription creation even if check fails
        }

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
                // CRITICAL: Mark as upgrade flow if existing subscription detected
                ...(isUpgradeFlow && existingSubscription && {
                    replacing_subscription_id: existingSubscription.subscriptionId,
                    upgrade_flow: 'true',
                }),
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
            amount: planDetails.priceUsd,
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
