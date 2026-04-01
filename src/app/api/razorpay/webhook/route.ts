import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { RAZORPAY_CONFIG, getPlanDetails, type PlanType } from '@/config/razorpay';

// CRITICAL: Disable body parser for signature verification
export const config = {
    api: { bodyParser: false }
};

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
        if (saBase64) {
            const serviceAccount = JSON.parse(
                Buffer.from(saBase64, 'base64').toString('utf-8')
            );
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    } catch(e: any) {
        console.warn('Firebase init deferred:', e.message);
    }
}

const getDb = () => admin.firestore();
const GRACE_PERIOD_DAYS = 7;

/**
 * Verify Razorpay webhook signature
 */
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    
    return expectedSignature === signature;
}

/**
 * Atomic dual write to both Firestore collections
 */
async function syncSubscriptionToFirestore(
    subscriptionId: string,
    userId: string,
    data: any
): Promise<void> {
    const db = getDb();
    const batch = db.batch();
    
    // Top-level collection for fast lookups
    const topLevelRef = db.collection('razorpaySubscriptions').doc(subscriptionId);
    
    // User-scoped subcollection
    const userRef = db.collection('users').doc(userId).collection('subscriptions').doc(subscriptionId);
    
    batch.set(topLevelRef, data, { merge: true });
    batch.set(userRef, data, { merge: true });
    
    await batch.commit();
}

/**
 * Get subscription with fallback lookup
 */
async function getSubscriptionWithFallback(
    subscriptionId: string,
    userId?: string
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
    const db = getDb();
    // Try direct lookup first
    let subscriptionDoc = await db.collection('razorpaySubscriptions').doc(subscriptionId).get();
    
    if (subscriptionDoc.exists) {
        return subscriptionDoc;
    }
    
    // Fallback: lookup from user subcollection if userId provided
    if (userId) {
        subscriptionDoc = await db.collection('users').doc(userId)
            .collection('subscriptions').doc(subscriptionId).get();
        
        if (subscriptionDoc.exists) {
            return subscriptionDoc;
        }
    }
    
    return null;
}

/**
 * Production Razorpay Webhook Handler
 * 
 * Handles both Subscription and Invoice events:
 * - Subscription events: State management
 * - Invoice events: Payment details and credit operations
 */
export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const body = await request.text();
        const signature = request.headers.get('x-razorpay-signature');

        if (!signature) {
            console.error('❌ Missing Razorpay signature');
            return NextResponse.json(
                { success: false, error: 'Missing signature' },
                { status: 400 }
            );
        }

        // Verify webhook signature using webhook secret (not API key secret)
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_CONFIG.keySecret;
        const isValid = verifyWebhookSignature(body, signature, webhookSecret);
        
        if (!isValid) {
            console.error('❌ Invalid Razorpay signature');
            return NextResponse.json(
                { success: false, error: 'Invalid signature' },
                { status: 401 }
            );
        }

        const event = JSON.parse(body);
        const { event: eventType, payload } = event;

        console.log(`📨 Razorpay webhook: ${eventType}`);

        // Handle different event types
        switch (eventType) {
            // ========== SUBSCRIPTION STATE EVENTS ==========
            
            case 'subscription.authenticated': {
                const subscription = payload.subscription.entity;
                const { userId, planType } = subscription.notes || {};

                if (!userId || !planType) {
                    console.error('❌ Missing userId or planType');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                const planDetails = getPlanDetails(planType as PlanType);
                
                await syncSubscriptionToFirestore(subscription.id, userId, {
                    userId,
                    planType,
                    subscriptionId: subscription.id,
                    status: 'authenticated',
                    credits: planDetails.credits,
                    initialCredits: planDetails.credits,
                    creditsUsed: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`✅ Subscription authenticated: ${subscription.id}`);
                break;
            }

            case 'subscription.activated': {
                const subscription = payload.subscription.entity;
                const payment = payload.payment?.entity;
                const { userId, planType } = subscription.notes || {};

                if (!userId || !planType) {
                    console.error('❌ Missing userId or planType');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                const planDetails = getPlanDetails(planType as PlanType);
                
                await syncSubscriptionToFirestore(subscription.id, userId, {
                    userId,
                    planType,
                    subscriptionId: subscription.id,
                    status: 'active',
                    credits: planDetails.credits,
                    initialCredits: planDetails.credits,
                    creditsUsed: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    activatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastPaymentId: payment?.id || null,
                    lastPaymentAmount: payment?.amount || 0,
                    lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`✅ Subscription activated: ${subscription.id}`);
                break;
            }

            case 'subscription.charged': {
                const subscription = payload.subscription.entity;
                const payment = payload.payment?.entity;
                const { userId } = subscription.notes || {};

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                await syncSubscriptionToFirestore(subscription.id, userId, {
                    lastPaymentId: payment?.id,
                    lastPaymentAmount: payment?.amount,
                    lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`✅ Subscription charged: ${subscription.id}`);
                break;
            }

            case 'subscription.pending': {
                const subscription = payload.subscription.entity;
                const { userId } = subscription.notes || {};

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                // Set grace period: 7 days from now
                const gracePeriodEnds = new Date();
                gracePeriodEnds.setDate(gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS);

                await syncSubscriptionToFirestore(subscription.id, userId, {
                    status: 'pending',
                    gracePeriodEndsAt: admin.firestore.Timestamp.fromDate(gracePeriodEnds),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`⏳ Subscription pending (grace period: ${GRACE_PERIOD_DAYS} days): ${subscription.id}`);
                break;
            }

            case 'subscription.halted': {
                const subscription = payload.subscription.entity;
                const { userId } = subscription.notes || {};

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                await syncSubscriptionToFirestore(subscription.id, userId, {
                    status: 'halted',
                    haltedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`🛑 Subscription halted: ${subscription.id}`);
                break;
            }

            case 'subscription.cancelled': {
                const subscription = payload.subscription.entity;
                const { userId } = subscription.notes || {};

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                await syncSubscriptionToFirestore(subscription.id, userId, {
                    status: 'cancelled',
                    cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`✅ Subscription cancelled: ${subscription.id}`);
                break;
            }

            case 'subscription.paused': {
                const subscription = payload.subscription.entity;
                const { userId } = subscription.notes || {};

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                await syncSubscriptionToFirestore(subscription.id, userId, {
                    status: 'paused',
                    pausedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`⏸️ Subscription paused: ${subscription.id}`);
                break;
            }

            case 'subscription.resumed': {
                const subscription = payload.subscription.entity;
                const { userId } = subscription.notes || {};

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                await syncSubscriptionToFirestore(subscription.id, userId, {
                    status: 'active',
                    resumedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`▶️ Subscription resumed: ${subscription.id}`);
                break;
            }

            case 'subscription.completed': {
                const subscription = payload.subscription.entity;
                const { userId } = subscription.notes || {};

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                await syncSubscriptionToFirestore(subscription.id, userId, {
                    status: 'completed',
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`✅ Subscription completed: ${subscription.id}`);
                break;
            }

            // ========== INVOICE PAYMENT EVENTS (PRIMARY FOR CREDITS) ==========

            case 'invoice.paid': {
                const invoice = payload.invoice.entity;
                const payment = payload.payment?.entity;
                const subscriptionId = invoice.subscription_id;

                if (!subscriptionId) {
                    console.log('⚠️ Invoice paid but no subscription_id');
                    return NextResponse.json({ success: true });
                }

                // Get subscription with fallback
                const subscriptionDoc = await getSubscriptionWithFallback(subscriptionId);
                
                if (!subscriptionDoc) {
                    console.error(`❌ Subscription not found: ${subscriptionId}`);
                    return NextResponse.json({ success: true });
                }

                const subscriptionData = subscriptionDoc.data();
                const userId = subscriptionData?.userId;
                const planType = subscriptionData?.planType;

                if (!userId || !planType) {
                    console.error('❌ Missing userId or planType in subscription');
                    return NextResponse.json({ success: true });
                }

                const planDetails = getPlanDetails(planType as PlanType);

                // PRIMARY: Reset credits on successful payment
                await syncSubscriptionToFirestore(subscriptionId, userId, {
                    status: 'active',
                    credits: planDetails.credits,
                    creditsUsed: 0,
                    lastPaymentId: payment?.id,
                    lastPaymentAmount: payment?.amount,
                    lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                    gracePeriodEndsAt: admin.firestore.FieldValue.delete(),
                    lastPaymentFailure: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`💳 Invoice paid - Credits reset: ${subscriptionId}`);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = payload.invoice.entity;
                const payment = payload.payment?.entity;
                const subscriptionId = invoice.subscription_id;

                if (!subscriptionId) {
                    console.log('⚠️ Invoice payment failed but no subscription_id');
                    return NextResponse.json({ success: true });
                }

                // Get subscription with fallback
                const subscriptionDoc = await getSubscriptionWithFallback(subscriptionId);
                
                if (!subscriptionDoc) {
                    console.error(`❌ Subscription not found: ${subscriptionId}`);
                    return NextResponse.json({ success: true });
                }

                const subscriptionData = subscriptionDoc.data();
                const userId = subscriptionData?.userId;

                if (!userId) {
                    console.error('❌ Missing userId in subscription');
                    return NextResponse.json({ success: true });
                }

                // Set grace period
                const gracePeriodEnds = new Date();
                gracePeriodEnds.setDate(gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS);

                await syncSubscriptionToFirestore(subscriptionId, userId, {
                    gracePeriodEndsAt: admin.firestore.Timestamp.fromDate(gracePeriodEnds),
                    lastPaymentFailure: {
                        paymentId: payment?.id || 'unknown',
                        errorCode: payment?.error_code || 'unknown',
                        errorDescription: payment?.error_description || 'Payment failed',
                        failedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`⚠️ Invoice payment failed (grace period: ${GRACE_PERIOD_DAYS} days): ${subscriptionId}`);
                break;
            }

            case 'invoice.partially_paid': {
                const invoice = payload.invoice.entity;
                const subscriptionId = invoice.subscription_id;

                if (subscriptionId) {
                    console.log(`💰 Invoice partially paid: ${subscriptionId}`);
                }
                break;
            }

            case 'invoice.expired': {
                const invoice = payload.invoice.entity;
                const subscriptionId = invoice.subscription_id;

                if (subscriptionId) {
                    console.log(`⏰ Invoice expired: ${subscriptionId}`);
                }
                break;
            }

            // ========== MASIV ONE-TIME PAYMENT EVENTS ==========
            
            case 'payment.captured': {
                const payment = payload.payment.entity;
                const orderId = payment.order_id;
                const paymentId = payment.id;

                if (!orderId) {
                    console.log('⚠️ Payment without order_id, skipping');
                    return NextResponse.json({ success: true });
                }

                // Check if this is a MASIV order by looking for the document
                const db = getDb();
                const orderRef = db.collection('masiv_orders').doc(orderId);
                const orderDoc = await orderRef.get();

                if (!orderDoc.exists) {
                    console.log(`⚠️ Order not found in masiv_orders: ${orderId}, might be subscription payment`);
                    return NextResponse.json({ success: true });
                }

                // Update the order with payment details
                await orderRef.update({
                    paymentId,
                    status: 'paid',
                    paidAt: admin.firestore.FieldValue.serverTimestamp(),
                    paymentDetails: {
                        amount: payment.amount,
                        method: payment.method,
                        email: payment.email,
                        contact: payment.contact,
                    },
                });

                console.log(`✅ MASIV order paid: ${orderId}, payment: ${paymentId}`);
                break;
            }

            case 'payment.failed': {
                const payment = payload.payment.entity;
                const orderId = payment.order_id;

                if (!orderId) {
                    console.log('⚠️ Failed payment without order_id, skipping');
                    return NextResponse.json({ success: true });
                }

                // Check if this is a MASIV order
                const db = getDb();
                const orderRef = db.collection('masiv_orders').doc(orderId);
                const orderDoc = await orderRef.get();

                if (!orderDoc.exists) {
                    console.log(`⚠️ Order not found in masiv_orders: ${orderId}`);
                    return NextResponse.json({ success: true });
                }

                // Update the order status to failed
                await orderRef.update({
                    status: 'failed',
                    failureReason: payment.error_description || 'Payment failed',
                    failedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`❌ MASIV order payment failed: ${orderId}`);
                break;
            }

            default:
                console.log(`⚠️ Unhandled event: ${eventType}`);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('❌ Webhook error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
