import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { RAZORPAY_CONFIG } from '@/config/razorpay';

export const runtime = 'nodejs';

const razorpay = new Razorpay({
    key_id: RAZORPAY_CONFIG.keyId,
    key_secret: RAZORPAY_CONFIG.keySecret,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, subscriptionId } = body;

        if (!userId || !subscriptionId) {
            return NextResponse.json(
                { error: 'Missing required fields: userId and subscriptionId' },
                { status: 400 }
            );
        }

        // Verify subscription exists and belongs to user
        const subscriptionDoc = await db
            .collection('users')
            .doc(userId)
            .collection('subscriptions')
            .doc(subscriptionId)
            .get();

        if (!subscriptionDoc.exists) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        const subscriptionData = subscriptionDoc.data();

        // Check if subscription is in a cancellable state
        if (subscriptionData?.status === 'cancelled') {
            return NextResponse.json(
                { error: 'Subscription is already cancelled' },
                { status: 400 }
            );
        }

        if (subscriptionData?.status !== 'active') {
            return NextResponse.json(
                { error: 'Only active subscriptions can be cancelled' },
                { status: 400 }
            );
        }

        // Check if already scheduled for cancellation
        if (subscriptionData?.cancelAtCycleEnd) {
            return NextResponse.json(
                { error: 'Subscription is already scheduled for cancellation' },
                { status: 400 }
            );
        }

        // Cancel subscription via Razorpay API
        // cancelAtCycleEnd: 1 = true (cancel at end of cycle), 0 = false (cancel immediately)
        const cancelledSubscription = await razorpay.subscriptions.cancel(
            subscriptionId,
            1
        );

        // Calculate when the subscription will actually end (next billing date)
        const willCancelAt = subscriptionData.nextBillingDate 
            ? Timestamp.fromDate(new Date(subscriptionData.nextBillingDate))
            : subscriptionData.activatedAt 
                ? Timestamp.fromDate(new Date(subscriptionData.activatedAt.toDate().getTime() + 30 * 24 * 60 * 60 * 1000))
                : Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

        // Prepare update data
        const updateData = {
            cancelledAt: FieldValue.serverTimestamp(),
            cancelAtCycleEnd: true,
            willCancelAt: willCancelAt,
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Atomic update to both collections
        const batch = db.batch();

        const topLevelRef = db.collection('razorpaySubscriptions').doc(subscriptionId);
        const userRef = db
            .collection('users')
            .doc(userId)
            .collection('subscriptions')
            .doc(subscriptionId);

        batch.update(topLevelRef, updateData);
        batch.update(userRef, updateData);

        await batch.commit();

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

        // Handle Razorpay specific errors
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
