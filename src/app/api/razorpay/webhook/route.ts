import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { RAZORPAY_CONFIG, PLAN_CREDITS, PlanType } from '@/config/razorpay';
import { db } from '@/config/firebase';
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { initializeSubscriptionCredits } from '@/services/CreditsService';

/**
 * Razorpay Webhook Handler
 * POST /api/razorpay/webhook
 * 
 * Handles subscription events:
 * - subscription.activated
 * - subscription.charged
 * - subscription.cancelled
 * - subscription.paused
 * - subscription.resumed
 * - subscription.completed
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const signature = request.headers.get('x-razorpay-signature');

        if (!signature) {
            return NextResponse.json(
                { success: false, error: 'Missing signature' },
                { status: 400 }
            );
        }

        // Verify webhook signature
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_CONFIG.keySecret;
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(body)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.error('❌ Webhook signature verification failed');
            return NextResponse.json(
                { success: false, error: 'Invalid signature' },
                { status: 400 }
            );
        }

        const event = JSON.parse(body);
        const eventType = event.event;
        const payload = event.payload;

        console.log(`📥 Razorpay webhook: ${eventType}`);

        // Handle different subscription events
        switch (eventType) {
            case 'subscription.activated':
                await handleSubscriptionActivated(payload);
                break;

            case 'subscription.charged':
                await handleSubscriptionCharged(payload);
                break;

            case 'subscription.cancelled':
                await handleSubscriptionCancelled(payload);
                break;

            case 'subscription.paused':
                await handleSubscriptionPaused(payload);
                break;

            case 'subscription.resumed':
                await handleSubscriptionResumed(payload);
                break;

            case 'subscription.completed':
                await handleSubscriptionCompleted(payload);
                break;

            default:
                console.log(`⚠️ Unhandled event type: ${eventType}`);
        }

        return NextResponse.json({ success: true, received: true });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Webhook processing failed',
            },
            { status: 500 }
        );
    }
}

// Event Handlers

async function handleSubscriptionActivated(payload: any) {
    const subscription = payload.subscription.entity;
    const userId = subscription.notes?.userId;
    const planType = subscription.notes?.planType as PlanType;

    if (!userId || !planType) {
        console.warn('⚠️ Missing userId or planType in subscription notes');
        return;
    }

    const initialCredits = PLAN_CREDITS[planType];
    if (!initialCredits) {
        console.warn(`⚠️ No credits defined for plan: ${planType}`);
        return;
    }

    // Create subscription document in user subcollection
    const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
    await setDoc(subscriptionRef, {
        userId,
        planType,
        subscriptionId: subscription.id,
        status: 'active',
        credits: initialCredits,
        initialCredits,
        creditsUsed: 0,
        activatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Initialize credits with transaction history
    await initializeSubscriptionCredits(userId, subscription.id, planType, initialCredits);

    // Also update root-level subscription for backward compatibility
    const rootSubRef = doc(db, 'subscriptions', userId);
    await setDoc(rootSubRef, {
        userId,
        planType,
        subscriptionId: subscription.id,
        status: 'active',
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Subscription activated for user: ${userId}, allocated ${initialCredits} credits`);
}

async function handleSubscriptionCharged(payload: any) {
    const payment = payload.payment.entity;
    const subscription = payload.subscription.entity;
    const userId = subscription.notes?.userId;
    const planType = subscription.notes?.planType as PlanType;

    if (!userId || !planType) {
        console.warn('⚠️ Missing userId or planType in subscription notes');
        return;
    }

    const initialCredits = PLAN_CREDITS[planType];
    if (!initialCredits) {
        console.warn(`⚠️ No credits defined for plan: ${planType}`);
        return;
    }

    // Reset credits on monthly charge (new billing cycle)
    const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
    await updateDoc(subscriptionRef, {
        lastPaymentId: payment.id,
        lastPaymentAmount: payment.amount,
        lastPaymentDate: serverTimestamp(),
        status: 'active',
        credits: initialCredits,
        creditsUsed: 0,
        updatedAt: serverTimestamp(),
    });

    // Also update root-level subscription
    const rootSubRef = doc(db, 'subscriptions', userId);
    await updateDoc(rootSubRef, {
        lastPaymentId: payment.id,
        lastPaymentAmount: payment.amount,
        lastPaymentDate: serverTimestamp(),
        status: 'active',
        updatedAt: serverTimestamp(),
    });

    console.log(`✅ Payment charged for user: ${userId}, credits reset to ${initialCredits}`);
}

async function handleSubscriptionCancelled(payload: any) {
    const subscription = payload.subscription.entity;
    const userId = subscription.notes?.userId;

    if (!userId) {
        console.warn('⚠️ No userId in subscription notes');
        return;
    }

    // Update subscription in user subcollection
    const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
    await updateDoc(subscriptionRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Also update root-level subscription
    const rootSubRef = doc(db, 'subscriptions', userId);
    await updateDoc(rootSubRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    console.log(`✅ Subscription cancelled for user: ${userId}`);
}

async function handleSubscriptionPaused(payload: any) {
    const subscription = payload.subscription.entity;
    const userId = subscription.notes?.userId;

    if (!userId) {
        console.warn('⚠️ No userId in subscription notes');
        return;
    }

    // Update subscription in user subcollection
    const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
    await updateDoc(subscriptionRef, {
        status: 'paused',
        pausedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Also update root-level subscription
    const rootSubRef = doc(db, 'subscriptions', userId);
    await updateDoc(rootSubRef, {
        status: 'paused',
        pausedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    console.log(`✅ Subscription paused for user: ${userId}`);
}

async function handleSubscriptionResumed(payload: any) {
    const subscription = payload.subscription.entity;
    const userId = subscription.notes?.userId;

    if (!userId) {
        console.warn('⚠️ No userId in subscription notes');
        return;
    }

    // Update subscription in user subcollection
    const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
    await updateDoc(subscriptionRef, {
        status: 'active',
        resumedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Also update root-level subscription
    const rootSubRef = doc(db, 'subscriptions', userId);
    await updateDoc(rootSubRef, {
        status: 'active',
        resumedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    console.log(`✅ Subscription resumed for user: ${userId}`);
}

async function handleSubscriptionCompleted(payload: any) {
    const subscription = payload.subscription.entity;
    const userId = subscription.notes?.userId;

    if (!userId) {
        console.warn('⚠️ No userId in subscription notes');
        return;
    }

    // Update subscription in user subcollection
    const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
    await updateDoc(subscriptionRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Also update root-level subscription
    const rootSubRef = doc(db, 'subscriptions', userId);
    await updateDoc(rootSubRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    console.log(`✅ Subscription completed for user: ${userId}`);
}
