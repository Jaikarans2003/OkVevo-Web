import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { RAZORPAY_CONFIG, getPlanDetailsByPeriod, getRazorpayPlanId, isSelfServePlanType, type SelfServePlanType } from '@/config/razorpay';

export const runtime = 'nodejs';

/**
 * UPI Upgrade Flow API
 * Creates new subscription FIRST, then cancels old one after activation
 * This prevents users from losing subscription if payment fails
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, oldSubscriptionId, newPlanType, newBillingPeriod = 'monthly', userEmail, userName } = body;

        if (!userId || !oldSubscriptionId || !newPlanType) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, oldSubscriptionId, newPlanType' },
                { status: 400 }
            );
        }

        // Validate plan type
        if (!isSelfServePlanType(newPlanType)) {
            return NextResponse.json(
                { error: 'Invalid plan type. Must be starter, pro, or max' },
                { status: 400 }
            );
        }

        // Fetch old subscription from Firestore
        const oldSubDoc = await db
            .collection('users')
            .doc(userId)
            .collection('subscriptions')
            .doc(oldSubscriptionId)
            .get();

        if (!oldSubDoc.exists) {
            return NextResponse.json(
                { error: 'Old subscription not found' },
                { status: 404 }
            );
        }

        const oldSubData = oldSubDoc.data();

        // Validate old subscription status
        if (oldSubData?.status !== 'active') {
            return NextResponse.json(
                { error: 'Old subscription must be active to upgrade' },
                { status: 400 }
            );
        }

        // Verify payment method is UPI or eMandate
        const paymentMethod = oldSubData?.payment_method;
        if (paymentMethod !== 'upi' && paymentMethod !== 'emandate') {
            return NextResponse.json(
                {
                    error: 'This endpoint is only for UPI/eMandate subscriptions',
                    message: 'Please use the regular update endpoint for Card/Netbanking',
                },
                { status: 400 }
            );
        }

        // Check if trying to change to same plan
        if (oldSubData?.planType === newPlanType) {
            return NextResponse.json(
                { error: 'You are already on this plan' },
                { status: 400 }
            );
        }

        // Initialize Razorpay instance
        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const planDetails = getPlanDetailsByPeriod(
            newPlanType as SelfServePlanType,
            newBillingPeriod as 'monthly' | 'annual'
        );
        const razorpayPlanId = getRazorpayPlanId(
            newPlanType as SelfServePlanType,
            newBillingPeriod as 'monthly' | 'annual'
        );

        console.log(`🔄 UPI Upgrade: Creating new ${newPlanType} subscription for user ${userId}`);
        console.log(`   Old subscription: ${oldSubscriptionId} will be cancelled after new one activates`);

        // CRITICAL: Create NEW subscription FIRST
        // Old subscription will be cancelled ONLY after this one is activated (in webhook)
        const newSubscription = await razorpay.subscriptions.create({
            plan_id: razorpayPlanId,
            total_count: newBillingPeriod === 'annual' ? 1 : 12,
            quantity: 1,
            customer_notify: 1,
            notes: {
                userId,
                planType: newPlanType,
                billingPeriod: newBillingPeriod,
                userEmail: userEmail || '',
                userName: userName || '',
                // CRITICAL: Mark this as upgrade flow
                replacing_subscription_id: oldSubscriptionId,
                upgrade_flow: 'true',
            },
        });

        console.log(`✅ New subscription created: ${newSubscription.id}`);
        console.log(`   User must complete UPI authorization`);
        console.log(`   Old subscription ${oldSubscriptionId} will auto-cancel after activation`);

        return NextResponse.json({
            success: true,
            flow: 'cancel_and_create',
            message: 'New subscription created. Please complete UPI authorization.',
            requiresNewAuth: true,
            newSubscriptionId: newSubscription.id,
            oldSubscriptionId: oldSubscriptionId,
            planId: razorpayPlanId,
            amount: planDetails.priceUsd,
            currency: planDetails.currency,
            razorpayKeyId: RAZORPAY_CONFIG.keyId,
            shortUrl: newSubscription.short_url,
            newPlanDetails: {
                name: planDetails.name,
                price: planDetails.priceUsd,
                period: planDetails.period,
            },
        });

    } catch (error: any) {
        console.error('❌ UPI upgrade error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to create upgrade subscription',
            },
            { status: 500 }
        );
    }
}
