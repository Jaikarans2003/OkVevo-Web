import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { RAZORPAY_CONFIG, getRazorpayPlanId, type PlanType } from '@/config/razorpay';

export const runtime = 'nodejs';

const razorpay = new Razorpay({
    key_id: RAZORPAY_CONFIG.keyId,
    key_secret: RAZORPAY_CONFIG.keySecret,
});

/**
 * Update Subscription API (Card/Netbanking only)
 * Schedules plan change at end of current billing cycle
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, subscriptionId, newPlanType, newBillingPeriod = 'monthly' } = body;

        if (!userId || !subscriptionId || !newPlanType) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, subscriptionId, newPlanType' },
                { status: 400 }
            );
        }

        // Validate plan type
        if (!['starter', 'hobby', 'pro'].includes(newPlanType)) {
            return NextResponse.json(
                { error: 'Invalid plan type. Must be starter, hobby, or pro' },
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

        // Validate subscription status
        if (subscriptionData?.status !== 'active' && subscriptionData?.status !== 'authenticated') {
            return NextResponse.json(
                { error: 'Subscription must be active or authenticated to update' },
                { status: 400 }
            );
        }

        // Check payment method - UPI/eMandate cannot be updated
        const paymentMethod = subscriptionData?.payment_method;
        if (paymentMethod === 'upi' || paymentMethod === 'emandate') {
            return NextResponse.json(
                {
                    error: 'UPI and eMandate subscriptions cannot be updated directly',
                    flow: 'upi_upgrade_required',
                    message: 'Please use the UPI upgrade flow to change your plan',
                },
                { status: 400 }
            );
        }

        // Check if already has scheduled changes
        if (subscriptionData?.has_scheduled_changes) {
            return NextResponse.json(
                {
                    error: 'Subscription already has a pending plan change',
                    message: 'Please cancel the existing scheduled change first',
                    scheduled_plan_type: subscriptionData.scheduled_plan_type,
                    change_scheduled_at: subscriptionData.change_scheduled_at,
                },
                { status: 400 }
            );
        }

        // Check if trying to change to same plan
        if (subscriptionData?.planType === newPlanType) {
            return NextResponse.json(
                { error: 'You are already on this plan' },
                { status: 400 }
            );
        }

        // Get new Razorpay plan ID
        const newPlanId = getRazorpayPlanId(newPlanType as PlanType, newBillingPeriod as 'monthly' | 'annual');

        console.log(`📝 Updating subscription ${subscriptionId} to plan ${newPlanType} (${newPlanId})`);

        // Call Razorpay update API
        const updatedSubscription = await razorpay.subscriptions.update(subscriptionId, {
            plan_id: newPlanId,
            schedule_change_at: 'cycle_end',
            customer_notify: 1,
        });

        // Calculate when change will take effect (next billing date)
        const changeScheduledAt = subscriptionData.nextBillingDate 
            ? Timestamp.fromDate(new Date(subscriptionData.nextBillingDate))
            : Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

        // Update Firestore with scheduled change
        const updateData = {
            has_scheduled_changes: true,
            change_scheduled_at: changeScheduledAt,
            scheduled_plan_id: newPlanId,
            scheduled_plan_type: newPlanType,
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

        console.log(`✅ Subscription update scheduled for ${changeScheduledAt.toDate().toISOString()}`);

        return NextResponse.json({
            success: true,
            flow: 'update',
            message: `Plan change scheduled for end of billing cycle`,
            scheduledChangeAt: changeScheduledAt.toDate().toISOString(),
            newPlanType,
            currentPlanType: subscriptionData.planType,
            subscription: {
                id: subscriptionId,
                has_scheduled_changes: true,
                scheduled_plan_type: newPlanType,
            },
        });

    } catch (error: any) {
        console.error('❌ Subscription update error:', error);

        // Handle Razorpay specific errors
        if (error.statusCode === 400) {
            return NextResponse.json(
                { error: error.error?.description || 'Invalid request to Razorpay' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to update subscription. Please try again.' },
            { status: 500 }
        );
    }
}
