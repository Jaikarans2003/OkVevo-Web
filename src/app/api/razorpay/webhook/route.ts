import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { RAZORPAY_CONFIG, getPlanDetails, type PlanType } from '@/config/razorpay';

export const runtime = 'nodejs';

// CRITICAL: Disable Next.js body parsing for raw body access (signature verification)
// In Next.js App Router, we read the raw body via request.text() directly
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
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    createdAt: FieldValue.serverTimestamp(),
                    activatedAt: FieldValue.serverTimestamp(),
                    lastPaymentId: payment?.id || null,
                    lastPaymentAmount: payment?.amount || 0,
                    lastPaymentDate: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    lastPaymentDate: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    gracePeriodEndsAt: Timestamp.fromDate(gracePeriodEnds),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    haltedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    cancelledAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    pausedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    resumedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    completedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    lastPaymentDate: FieldValue.serverTimestamp(),
                    gracePeriodEndsAt: FieldValue.delete(),
                    lastPaymentFailure: FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                    gracePeriodEndsAt: Timestamp.fromDate(gracePeriodEnds),
                    lastPaymentFailure: {
                        paymentId: payment?.id || 'unknown',
                        errorCode: payment?.error_code || 'unknown',
                        errorDescription: payment?.error_description || 'Payment failed',
                        failedAt: FieldValue.serverTimestamp(),
                    },
                    updatedAt: FieldValue.serverTimestamp(),
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
                const orderRef = db.collection('masiv_orders').doc(orderId);
                const orderDoc = await orderRef.get();

                if (!orderDoc.exists) {
                    console.log(`⚠️ Order not found in masiv_orders: ${orderId}, might be subscription payment`);
                    return NextResponse.json({ success: true });
                }

                const orderData = orderDoc.data();
                
                // Update the order with payment details
                await orderRef.update({
                    paymentId,
                    status: 'paid',
                    paidAt: FieldValue.serverTimestamp(),
                    paymentDetails: {
                        amount: payment.amount,
                        method: payment.method,
                        email: payment.email,
                        contact: payment.contact,
                    },
                });

                console.log(`✅ MASIV order paid: ${orderId}, payment: ${paymentId}`);

                // Handle coupon usage tracking
                if (orderData?.couponCode && orderData?.whatsappNumber) {
                    const couponUsageData = {
                        userId: orderData.userId,
                        phoneNumber: orderData.whatsappNumber,
                        couponCode: orderData.couponCode,
                        orderId,
                        discountApplied: orderData.discountAmount || 0,
                        usedAt: FieldValue.serverTimestamp(),
                    };
                    
                    await db.collection('couponUsage').add(couponUsageData);
                    console.log(`📋 Coupon usage recorded: ${orderData.couponCode}`);
                }

                // Handle affiliate commission
                // Note: Sales sub-collection is created via "Sync Stats" button in admin panel
                if (orderData?.affiliateId && orderData?.affiliateCommission) {
                    const affiliateRef = db.collection('affiliates').doc(orderData.affiliateId);
                    await affiliateRef.update({
                        totalSales: FieldValue.increment(1),
                        totalEarnings: FieldValue.increment(orderData.affiliateCommission),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    console.log(`💰 Affiliate commission updated: ${orderData.affiliateId}, +₹${orderData.affiliateCommission}`);
                    console.log(`ℹ️ Sales sub-collection will be created when admin clicks "Sync Stats"`);
                }

                // Purchase history already updated when order was created
                // No need to update again on payment success
                if (orderData?.whatsappNumber) {
                    console.log(`📊 Purchase history already tracked for: ${orderData.whatsappNumber}`);
                }

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
                const orderRef = db.collection('masiv_orders').doc(orderId);
                const orderDoc = await orderRef.get();

                if (!orderDoc.exists) {
                    console.log(`⚠️ Order not found in masiv_orders: ${orderId}`);
                    return NextResponse.json({ success: true });
                }

                const orderData = orderDoc.data();

                // Update the order status to failed
                await orderRef.update({
                    status: 'failed',
                    failureReason: payment.error_description || 'Payment failed',
                    failedAt: FieldValue.serverTimestamp(),
                });

                console.log(`❌ MASIV order payment failed: ${orderId}`);

                // Rollback purchase history
                if (orderData?.whatsappNumber) {
                    const historyRef = db.collection('userPurchaseHistory').doc(orderData.whatsappNumber);
                    const updates: any = {
                        purchaseCount: FieldValue.increment(-1),
                        orders: FieldValue.arrayRemove(orderId),
                    };

                    if (orderData.couponCode) {
                        updates.usedCoupons = FieldValue.arrayRemove(orderData.couponCode);
                    }

                    await historyRef.update(updates);
                    console.log(`🔄 Rolled back purchase history for: ${orderData.whatsappNumber}`);
                }

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
