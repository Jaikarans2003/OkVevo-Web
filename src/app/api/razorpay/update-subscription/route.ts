import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
    RAZORPAY_CONFIG,
    getRazorpayPlanId,
    isSelfServePlanType,
    parseBillingCurrency,
    type BillingPeriod,
    type SelfServePlanType,
} from '@/config/razorpay';
import { uidFromIdToken } from '@/lib/gateway/auth';
import {
    isUpiLikePaymentMethod,
    isUpiSubscriptionUpdateError,
    isUpdatablePlanStatus,
    loadUserBillingSoT,
    normalizePaymentMethod,
    razorpayErrorDescription,
} from '@/lib/billing/userSoT';
import { isSamePlan, scheduleChangeAt } from '@/lib/billing/planChange';

export const runtime = 'nodejs';

/**
 * Razorpay Update Subscription (card/netbanking).
 * Upgrade → schedule_change_at: now (prorate immediately).
 * Downgrade → cycle_end (no charge now).
 * Never send start_at / remaining_count — billing date must not reset.
 * UPI/eMandate: upgrade returns flow upi_upgrade_required; downgrade is local-only.
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
        const newBillingPeriod: BillingPeriod =
            body.newBillingPeriod === 'annual' ? 'annual' : 'monthly';

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

        const billing = await loadUserBillingSoT(user.uid);
        const subscriptionId = billing.razorpaySubscriptionId;

        if (!subscriptionId) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        if (!isUpdatablePlanStatus(billing.planStatus)) {
            return NextResponse.json(
                { error: 'Subscription must be active or authenticated to update' },
                { status: 400 }
            );
        }

        if (billing.hasScheduledChanges) {
            return NextResponse.json(
                {
                    error: 'Subscription already has a pending plan change',
                    message: 'Please cancel the existing scheduled change first',
                    scheduled_plan_type: billing.scheduledPlanType,
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
        const currency = parseBillingCurrency(billing.currency, 'USD');
        const newPlanId = getRazorpayPlanId(newPlanType as SelfServePlanType, newBillingPeriod, currency);

        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        let paymentMethod = billing.paymentMethod;
        if (!paymentMethod) {
            try {
                const fetched = await razorpay.subscriptions.fetch(subscriptionId);
                paymentMethod = normalizePaymentMethod(
                    (fetched as { payment_method?: unknown }).payment_method
                );
                if (paymentMethod) {
                    await db.collection('users').doc(user.uid).set(
                        { paymentMethod, updatedAt: FieldValue.serverTimestamp() },
                        { merge: true }
                    );
                }
            } catch (fetchErr) {
                console.warn('subscription fetch for paymentMethod failed', fetchErr);
            }
        }

        if (isUpiLikePaymentMethod(paymentMethod)) {
            if (when === 'now') {
                return NextResponse.json(
                    {
                        error: 'UPI and eMandate subscriptions cannot be updated directly',
                        flow: 'upi_upgrade_required',
                        message: 'Please use the UPI upgrade flow to change your plan',
                    },
                    { status: 400 }
                );
            }
            return persistUpiDowngrade(user.uid, billing.currentPeriodEnd, newPlanId, newPlanType, billing.plan);
        }

        try {
            const updated = await razorpay.subscriptions.update(subscriptionId, {
                plan_id: newPlanId,
                schedule_change_at: when,
                customer_notify: 1,
            });

            if (when === 'cycle_end') {
                const changeScheduledAt =
                    typeof updated.change_scheduled_at === 'number'
                        ? Timestamp.fromMillis(updated.change_scheduled_at * 1000)
                        : billing.currentPeriodEnd
                          ?? Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

                await db.collection('users').doc(user.uid).set(
                    {
                        hasScheduledChanges: true,
                        scheduledChangeAt: changeScheduledAt,
                        scheduledPlanId: newPlanId,
                        scheduledPlanType: newPlanType,
                        updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );

                return NextResponse.json({
                    success: true,
                    flow: 'update',
                    scheduleChangeAt: when,
                    message: 'Plan change scheduled for end of billing cycle',
                    scheduledChangeAt: changeScheduledAt.toDate().toISOString(),
                    newPlanType,
                    currentPlanType: billing.plan,
                    subscription: {
                        id: subscriptionId,
                        has_scheduled_changes: true,
                        scheduled_plan_type: newPlanType,
                    },
                });
            }

            return NextResponse.json({
                success: true,
                flow: 'update',
                scheduleChangeAt: when,
                message: 'Plan upgraded. The difference is charged now; your billing date is unchanged.',
                newPlanType,
                currentPlanType: billing.plan,
                subscription: {
                    id: subscriptionId,
                    has_scheduled_changes: false,
                },
            });
        } catch (updateErr: unknown) {
            if (isUpiSubscriptionUpdateError(updateErr)) {
                if (when === 'cycle_end') {
                    return persistUpiDowngrade(
                        user.uid,
                        billing.currentPeriodEnd,
                        newPlanId,
                        newPlanType,
                        billing.plan
                    );
                }
                return NextResponse.json(
                    {
                        error: 'UPI and eMandate subscriptions cannot be updated directly',
                        flow: 'upi_upgrade_required',
                        message: 'Please use the UPI upgrade flow to change your plan',
                    },
                    { status: 400 }
                );
            }
            const description = razorpayErrorDescription(updateErr);
            const statusCode =
                typeof updateErr === 'object' &&
                updateErr &&
                'statusCode' in updateErr &&
                (updateErr as { statusCode?: number }).statusCode === 400
                    ? 400
                    : 500;
            return NextResponse.json(
                {
                    error:
                        statusCode === 400
                            ? description
                            : 'Failed to update subscription. Please try again.',
                },
                { status: statusCode }
            );
        }
    } catch (error: unknown) {
        console.error('❌ Subscription update error:', error);
        return NextResponse.json(
            { error: 'Failed to update subscription. Please try again.' },
            { status: 500 }
        );
    }
}

async function persistUpiDowngrade(
    uid: string,
    currentPeriodEnd: Timestamp | null,
    newPlanId: string,
    newPlanType: string,
    currentPlanType: string | null
) {
    const changeScheduledAt =
        currentPeriodEnd ?? Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    await db.collection('users').doc(uid).set(
        {
            hasScheduledChanges: true,
            scheduledChangeAt: changeScheduledAt,
            scheduledPlanId: newPlanId,
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
        currentPlanType: currentPlanType,
        subscription: {
            has_scheduled_changes: true,
            scheduled_plan_type: newPlanType,
        },
    });
}
