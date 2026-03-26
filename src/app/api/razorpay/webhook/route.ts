import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { RAZORPAY_CONFIG, PLAN_CREDITS, PlanType } from '@/config/razorpay';
import { db } from '@/config/firebase';
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
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
    console.log('🔔 Webhook endpoint hit at:', new Date().toISOString());
    
    try {
        const body = await request.text();
        const signature = request.headers.get('x-razorpay-signature');
        const eventId = request.headers.get('x-razorpay-event-id');
        
        console.log('📨 Webhook headers:', {
            signature: signature ? 'present' : 'missing',
            eventId: eventId || 'none',
            contentType: request.headers.get('content-type')
        });

        if (!signature) {
            console.error('❌ Missing signature in webhook request');
            return NextResponse.json(
                { success: false, error: 'Missing signature' },
                { status: 400 }
            );
        }

        // Verify webhook signature
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_CONFIG.keySecret;
        console.log('🔐 Using webhook secret:', webhookSecret ? `${webhookSecret.substring(0, 3)}***` : 'MISSING');
        
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(body)
            .digest('hex');

        console.log('🔍 Signature verification:', {
            expected: expectedSignature.substring(0, 10) + '...',
            received: signature.substring(0, 10) + '...',
            match: expectedSignature === signature
        });

        if (expectedSignature !== signature) {
            console.error('❌ Webhook signature verification failed');
            console.error('Expected:', expectedSignature);
            console.error('Received:', signature);
            console.error('Body length:', body.length);
            return NextResponse.json(
                { success: false, error: 'Invalid signature' },
                { status: 400 }
            );
        }
        
        console.log('✅ Signature verified successfully');

        const event = JSON.parse(body);
        const eventType = event.event;
        const payload = event.payload;

        console.log(`📥 Razorpay webhook: ${eventType}`);
        console.log('📦 Payload preview:', JSON.stringify(payload).substring(0, 200) + '...');

        // Handle different subscription and payment events
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

            case 'payment.captured':
                await handlePaymentCaptured(payload);
                break;

            case 'payment.failed':
                await handlePaymentFailed(payload);
                break;

            default:
                console.log(`⚠️ Unhandled event type: ${eventType}`);
        }

        console.log('✅ Webhook processed successfully');
        return NextResponse.json({ success: true, received: true });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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

async function handlePaymentCaptured(payload: any) {
    const payment = payload.payment.entity;
    const orderId = payment.order_id;
    
    console.log('🎯 handlePaymentCaptured called');
    console.log('📋 OrderId from webhook:', orderId);
    console.log('💳 Payment ID:', payment.id);

    if (!orderId) {
        console.warn('⚠️ No order_id in payment entity');
        return;
    }

    try {
        // Find and update the masiv_orders document with this order ID
        const ordersRef = collection(db, 'masiv_orders');
        const q = query(ordersRef, where('razorpayOrderId', '==', orderId));
        
        console.log('🔍 Querying Firestore for razorpayOrderId:', orderId);
        const snapshot = await getDocs(q);
        console.log('📊 Docs found:', snapshot.size);

        if (snapshot.empty) {
            console.error(`❌ No MASIV order found for order_id: ${orderId}`);
            console.error('🔍 This means either:');
            console.error('   1. Order was not created in Firestore');
            console.error('   2. razorpayOrderId field does not match');
            console.error('   3. Order is in different collection');
            return;
        }

        // Update the first matching document - WEBHOOK VERIFICATION (TRUSTED)
        const orderDoc = snapshot.docs[0];
        console.log('📝 Found order document ID:', orderDoc.id);
        console.log('📄 Current order data:', JSON.stringify(orderDoc.data()).substring(0, 200));
        
        console.log('🔄 Updating order with webhook verification...');
        await updateDoc(doc(db, 'masiv_orders', orderDoc.id), {
            paymentStatus: 'paid',
            isVerified: true,  // CRITICAL: Only webhook can set this to true
            status: 'processing',  // Move order to processing stage
            razorpayPaymentId: payment.id,
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        console.log(`✅ Payment captured and verified for MASIV order: ${orderId}`);
        console.log('✅ Order updated successfully with isVerified: true, status: processing');
    } catch (error) {
        console.error('❌ Error updating MASIV payment status:', error);
        console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    }
}

async function handlePaymentFailed(payload: any) {
    const payment = payload.payment.entity;
    const orderId = payment.order_id;

    if (!orderId) {
        console.warn('⚠️ No order_id in payment entity');
        return;
    }

    try {
        // Find and update the masiv_orders document with this order ID
        const ordersRef = collection(db, 'masiv_orders');
        const q = query(ordersRef, where('razorpayOrderId', '==', orderId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.warn(`⚠️ No MASIV order found for order_id: ${orderId}`);
            return;
        }

        // Update the first matching document
        const orderDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'masiv_orders', orderDoc.id), {
            paymentStatus: 'failed',
            isVerified: true,  // Verified as failed by webhook
            status: 'failed',  // Mark order as failed
            updatedAt: serverTimestamp(),
        });

        console.log(`❌ Payment failed and verified for MASIV order: ${orderId}`);
    } catch (error) {
        console.error('❌ Error updating failed payment status:', error);
    }
}
