import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { RAZORPAY_CONFIG } from '@/config/razorpay';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { isUpiLikePaymentMethod, isUpiSubscriptionUpdateError, loadUserBillingSoT, razorpayErrorDescription } from '@/lib/billing/userSoT';

export const runtime = 'nodejs';

/**
 * Cancel a pending plan change scheduled for end of cycle.
 */
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

        if (!billing.hasScheduledChanges) {
            return NextResponse.json(
                { error: 'No scheduled changes to cancel' },
                { status: 400 }
            );
        }

        if (!isUpiLikePaymentMethod(billing.paymentMethod)) {
            const razorpay = new Razorpay({
                key_id: RAZORPAY_CONFIG.keyId,
                key_secret: RAZORPAY_CONFIG.keySecret,
            });
            try {
                await razorpay.subscriptions.cancelScheduledChanges(subscriptionId);
            } catch (error: unknown) {
                if (!isUpiSubscriptionUpdateError(error)) throw error;
            }
        }

        await db.collection('users').doc(user.uid).set(
            {
                hasScheduledChanges: false,
                scheduledChangeAt: FieldValue.delete(),
                scheduledPlanId: FieldValue.delete(),
                scheduledPlanType: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return NextResponse.json({
            success: true,
            message: 'Scheduled plan change cancelled successfully',
            subscription: {
                id: subscriptionId,
                has_scheduled_changes: false,
            },
        });

    } catch (error: any) {
        console.error('❌ Cancel scheduled change error:', error);

        if (error.statusCode === 400) {
            return NextResponse.json(
                { error: razorpayErrorDescription(error) },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to cancel scheduled change. Please try again.' },
            { status: 500 }
        );
    }
}
