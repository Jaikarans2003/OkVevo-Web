import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { RAZORPAY_CONFIG } from '@/config/razorpay';
import { db } from '@/config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_CONFIG.keySecret)
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

    if (!userId) {
        console.warn('⚠️ No userId in subscription notes');
        return;
    }

    await updateDoc(doc(db, 'subscriptions', userId), {
        status: 'active',
        subscriptionId: subscription.id,
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    console.log(`✅ Subscription activated for user: ${userId}`);
}

async function handleSubscriptionCharged(payload: any) {
    const payment = payload.payment.entity;
    const subscription = payload.subscription.entity;
    const userId = subscription.notes?.userId;

    if (!userId) {
        console.warn('⚠️ No userId in subscription notes');
        return;
    }

    await updateDoc(doc(db, 'subscriptions', userId), {
        lastPaymentId: payment.id,
        lastPaymentAmount: payment.amount,
        lastPaymentDate: serverTimestamp(),
        status: 'active',
        updatedAt: serverTimestamp(),
    });

    console.log(`✅ Payment charged for user: ${userId}, amount: ${payment.amount}`);
}

async function handleSubscriptionCancelled(payload: any) {
    const subscription = payload.subscription.entity;
    const userId = subscription.notes?.userId;

    if (!userId) {
        console.warn('⚠️ No userId in subscription notes');
        return;
    }

    await updateDoc(doc(db, 'subscriptions', userId), {
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

    await updateDoc(doc(db, 'subscriptions', userId), {
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

    await updateDoc(doc(db, 'subscriptions', userId), {
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

    await updateDoc(doc(db, 'subscriptions', userId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    console.log(`✅ Subscription completed for user: ${userId}`);
}
