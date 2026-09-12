import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { RAZORPAY_CONFIG } from '@/config/razorpay';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { isCancellablePlanStatus, loadUserBillingSoT } from '@/lib/billing/userSoT';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const user = await uidFromIdToken(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const billing = await loadUserBillingSoT(user.uid);
        const subscriptionId = billing.razorpaySubscriptionId;

        if (!subscriptionId) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        if (!isCancellablePlanStatus(billing.planStatus)) {
            return NextResponse.json(
                { error: billing.planStatus === 'cancelled'
                    ? 'Subscription is already cancelled'
                    : 'Only active subscriptions can be cancelled' },
                { status: 400 }
            );
        }

        if (billing.cancelAtPeriodEnd) {
            return NextResponse.json(
                { error: 'Subscription is already scheduled for cancellation' },
                { status: 400 }
            );
        }

        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const cancelledSubscription = await razorpay.subscriptions.cancel(
            subscriptionId,
            1
        );

        const willCancelAt = billing.currentPeriodEnd
            ?? Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

        await db.collection('users').doc(user.uid).set(
            {
                cancelAtPeriodEnd: true,
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return NextResponse.json({
            success: true,
            message: 'Subscription scheduled for cancellation at end of billing cycle',
            willCancelAt: willCancelAt.toDate().toISOString(),
            subscription: {
                id: subscriptionId,
                status: cancelledSubscription.status,
                cancelAtCycleEnd: true,
            },
        });
    } catch (error: any) {
        console.error('Error cancelling subscription:', error);

        if (error.statusCode === 400) {
            return NextResponse.json(
                { error: error.error?.description || 'Invalid request to Razorpay' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to cancel subscription. Please try again.' },
            { status: 500 }
        );
    }
}
