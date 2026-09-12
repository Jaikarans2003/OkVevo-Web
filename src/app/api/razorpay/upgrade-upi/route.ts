import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { RAZORPAY_CONFIG, getPlanDetailsByPeriod, getRazorpayPlanId, isSelfServePlanType, parseBillingCurrency, type SelfServePlanType } from '@/config/razorpay';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { isUpiLikePaymentMethod, loadUserBillingSoT, razorpayErrorDescription } from '@/lib/billing/userSoT';
import { isSamePlan, scheduleChangeAt } from '@/lib/billing/planChange';

export const runtime = 'nodejs';

/**
 * UPI Upgrade Flow API
 * Creates new subscription FIRST, then cancels old one after activation.
 * uid + current sub id come from users/{uid}, not the body.
 * Downgrades are local-only (no new sub, no charge now).
 */
export async function POST(request: NextRequest) {
    const user = await uidFromIdToken(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let body: { newPlanType?: unknown; newBillingPeriod?: unknown };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        const newPlanType = body.newPlanType;
        const newBillingPeriod = body.newBillingPeriod === 'annual' ? 'annual' : 'monthly';
        const userId = user.uid;

        if (!newPlanType || typeof newPlanType !== 'string') {
            return NextResponse.json(
                { error: 'Missing required field: newPlanType' },
                { status: 400 }
            );
        }

        if (!isSelfServePlanType(newPlanType)) {
            return NextResponse.json(
                { error: 'Invalid plan type. Must be starter, pro, or max' },
                { status: 400 }
            );
        }

        const billing = await loadUserBillingSoT(userId);
        const oldSubscriptionId = billing.razorpaySubscriptionId;

        if (!oldSubscriptionId) {
            return NextResponse.json(
                { error: 'Old subscription not found' },
                { status: 404 }
            );
        }

        if (billing.planStatus !== 'active') {
            return NextResponse.json(
                { error: 'Old subscription must be active to upgrade' },
                { status: 400 }
            );
        }

        const paymentMethod = billing.paymentMethod;
        if (paymentMethod && !isUpiLikePaymentMethod(paymentMethod)) {
            return NextResponse.json(
                {
                    error: 'This endpoint is only for UPI/eMandate subscriptions',
                    message: 'Please use the regular update endpoint for Card/Netbanking',
                },
                { status: 400 }
            );
        }

        if (isSamePlan(billing.plan, billing.billingCycle, newPlanType, newBillingPeriod)) {
            return NextResponse.json(
                { error: 'You are already on this plan' },
                { status: 400 }
            );
        }

        const when = scheduleChangeAt(
            billing.plan,
            billing.billingCycle,
            newPlanType,
            newBillingPeriod
        );
        const planCurrency = parseBillingCurrency(billing.currency, 'USD');
        const razorpayPlanId = getRazorpayPlanId(
            newPlanType as SelfServePlanType,
            newBillingPeriod,
            planCurrency
        );

        if (when === 'cycle_end') {
            const changeScheduledAt =
                billing.currentPeriodEnd ??
                Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
            await db.collection('users').doc(userId).set(
                {
                    hasScheduledChanges: true,
                    scheduledChangeAt: changeScheduledAt,
                    scheduledPlanId: razorpayPlanId,
                    scheduledPlanType: newPlanType,
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            return NextResponse.json({
                success: true,
                flow: 'update',
                scheduleChangeAt: 'cycle_end',
                message: 'Plan change scheduled for end of billing cycle',
                scheduledChangeAt: changeScheduledAt.toDate().toISOString(),
                newPlanType,
                currentPlanType: billing.plan,
            });
        }

        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const planDetails = getPlanDetailsByPeriod(
            newPlanType as SelfServePlanType,
            newBillingPeriod,
            planCurrency
        );

        const newSubscription = await razorpay.subscriptions.create({
            plan_id: razorpayPlanId,
            total_count: newBillingPeriod === 'annual' ? 1 : 12,
            quantity: 1,
            customer_notify: 1,
            notes: {
                userId,
                planType: newPlanType,
                billingPeriod: newBillingPeriod,
                currency: planCurrency,
                userEmail: user.email || '',
                userName: user.name || '',
                replacing_subscription_id: oldSubscriptionId,
                upgrade_flow: 'true',
            },
        });

        return NextResponse.json({
            success: true,
            flow: 'cancel_and_create',
            message: 'New subscription created. Please complete UPI authorization.',
            requiresNewAuth: true,
            newSubscriptionId: newSubscription.id,
            oldSubscriptionId,
            planId: razorpayPlanId,
            amount: planDetails.price,
            currency: planDetails.currency,
            razorpayKeyId: RAZORPAY_CONFIG.keyId,
            shortUrl: newSubscription.short_url,
            newPlanDetails: {
                name: planDetails.name,
                price: planDetails.price,
                period: planDetails.period,
            },
        });

    } catch (error: unknown) {
        console.error('❌ UPI upgrade error:', error);
        return NextResponse.json(
            {
                error: razorpayErrorDescription(error) || 'Failed to create upgrade subscription',
            },
            { status: 500 }
        );
    }
}
