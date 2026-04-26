import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { RAZORPAY_CONFIG } from '@/config/razorpay';

export const runtime = 'nodejs';

const razorpay = new Razorpay({
    key_id: RAZORPAY_CONFIG.keyId,
    key_secret: RAZORPAY_CONFIG.keySecret,
});

/**
 * Cancel Scheduled Change API
 * Cancels a pending plan change that was scheduled for end of cycle
 */
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

        // Fetch subscription from Firestore
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

        // Verify subscription has scheduled changes
        if (!subscriptionData?.has_scheduled_changes) {
            return NextResponse.json(
                { error: 'No scheduled changes to cancel' },
                { status: 400 }
            );
        }

        console.log(`🚫 Cancelling scheduled change for subscription ${subscriptionId}`);

        // Call Razorpay to cancel scheduled changes
        await razorpay.subscriptions.cancelScheduledChanges(subscriptionId);

        // Update Firestore to remove scheduled change metadata
        const updateData = {
            has_scheduled_changes: false,
            change_scheduled_at: FieldValue.delete(),
            scheduled_plan_id: FieldValue.delete(),
            scheduled_plan_type: FieldValue.delete(),
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

        console.log(`✅ Scheduled change cancelled for subscription ${subscriptionId}`);

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
                { error: error.error?.description || 'Invalid request to Razorpay' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to cancel scheduled change. Please try again.' },
            { status: 500 }
        );
    }
}
