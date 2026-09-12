import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import {
    RAZORPAY_CONFIG,
    getPlanDetailsByPeriod,
    getRazorpayPlanId,
    isBillingCurrency,
    isSelfServePlanType,
    parseBillingCurrency,
    type BillingCurrency,
    type BillingPeriod,
    type SelfServePlanType,
} from '@/config/razorpay';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { loadUserBillingSoT } from '@/lib/billing/userSoT';

/**
 * Create Razorpay Subscription
 * POST /api/razorpay/create-subscription
 *
 * uid comes from the verified ID token — never from the body.
 */
export async function POST(request: NextRequest) {
    const user = await uidFromIdToken(request);
    if (!user) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const { planType, billingPeriod = 'monthly', couponCode, currency: currencyRaw } = body;
        const userId = user.uid;
        const userEmail = user.email;
        const userName = user.name;

        if (!planType) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: planType' },
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

        if (currencyRaw != null && !isBillingCurrency(currencyRaw)) {
            return NextResponse.json(
                { success: false, error: 'Invalid currency. Must be "INR" or "USD"' },
                { status: 400 }
            );
        }

        const billing = await loadUserBillingSoT(userId);
        const requestedCurrency: BillingCurrency = parseBillingCurrency(currencyRaw, 'USD');
        const liveSub =
            !!billing.razorpaySubscriptionId &&
            (billing.planStatus === 'active' || billing.planStatus === 'authenticated');
        const currency: BillingCurrency = liveSub
            ? (billing.currency ?? 'USD')
            : requestedCurrency;
        if (liveSub && currency !== requestedCurrency) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Plan changes must stay in the same currency as the existing subscription',
                },
                { status: 400 }
            );
        }

        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const planDetails = getPlanDetailsByPeriod(
            planType as SelfServePlanType,
            billingPeriod as BillingPeriod,
            currency
        );
        const razorpayPlanId = getRazorpayPlanId(
            planType as SelfServePlanType,
            billingPeriod as BillingPeriod,
            currency
        );

        let existingSubscriptionId: string | null = null;
        let isUpgradeFlow = false;

        if (billing.razorpaySubscriptionId && billing.planStatus === 'active') {
            existingSubscriptionId = billing.razorpaySubscriptionId;
            if (billing.plan && billing.plan !== planType) {
                isUpgradeFlow = true;
            }
        }

        const affiliateOfferId = process.env.RAZORPAY_AFFILIATE_OFFER_ID || '';
        const shouldApplyOffer = couponCode?.valid && couponCode.type === 'affiliate' && couponCode.discountAmount > 0 && affiliateOfferId;

        const subscription = await razorpay.subscriptions.create({
            plan_id: razorpayPlanId,
            total_count: billingPeriod === 'annual' ? 1 : 12,
            quantity: 1,
            customer_notify: 1,
            ...(shouldApplyOffer && { offer_id: affiliateOfferId }),
            notes: {
                userId,
                planType,
                billingPeriod,
                currency,
                userEmail: userEmail || '',
                userName: userName || '',
                ...(isUpgradeFlow && existingSubscriptionId && {
                    replacing_subscription_id: existingSubscriptionId,
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
