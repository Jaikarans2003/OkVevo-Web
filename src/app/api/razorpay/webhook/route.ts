import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { RAZORPAY_CONFIG, getPlanDetails, type PlanType } from '@/config/razorpay';

export const runtime = 'nodejs';

// CRITICAL: Disable Next.js body parsing for raw body access (signature verification)
// In Next.js App Router, we read the raw body via request.text() directly
const GRACE_PERIOD_DAYS = 7;

// Status priority hierarchy to prevent race conditions
const STATUS_PRIORITY: Record<string, number> = {
    active: 5,
    authenticated: 4,
    pending: 3,
    halted: 2,
    paused: 2,
    cancelled: 1,
    completed: 1,
};

const TERMINAL_STATES = ['cancelled', 'completed'];

function shouldUpdateStatus(currentStatus: string | undefined, newStatus: string): boolean {
    if (!currentStatus) return true;
    
    // Never overwrite terminal states
    if (TERMINAL_STATES.includes(currentStatus)) return false;
    
    const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
    const newPriority = STATUS_PRIORITY[newStatus] || 0;
    
    // Strict greater than — same-priority events don't overwrite
    return newPriority > currentPriority;
}

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
                // subscription.authenticated is NOT trusted for status.
                // It fires at the same time as subscription.activated and causes race conditions.
                // We only use it to seed coupon fields if activated hasn't written them yet.
                const subscription = payload.subscription.entity;
                const { userId, planType } = subscription.notes || {};

                if (!userId || !planType) {
                    console.error('❌ Missing userId or planType');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                const notes = subscription.notes || {};

                // Only write coupon fields — NEVER write status from this event
                if (notes.couponCode) {
                    const subscriptionRef = db.collection('razorpaySubscriptions').doc(subscription.id);
                    
                    await db.runTransaction(async (t) => {
                        const doc = await t.get(subscriptionRef);
                        const data = doc.data();
                        
                        // Only seed coupon fields if not already written
                        if (!data?.couponCode) {
                            const couponFields = {
                                couponCode: notes.couponCode,
                                couponType: notes.couponType || '',
                                affiliateId: notes.affiliateId || '',
                                discountAmount: notes.discountAmount || '0',
                                couponApplied: 'true',
                            };
                            
                            t.set(subscriptionRef, couponFields, { merge: true });
                            t.set(
                                db.collection('users').doc(userId).collection('subscriptions').doc(subscription.id),
                                couponFields,
                                { merge: true }
                            );
                        }
                    });
                }

                console.log(`✅ Subscription authenticated (no status write): ${subscription.id}`);
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

                const existingDoc = await getSubscriptionWithFallback(subscription.id, userId);
                const existingData = existingDoc?.data();
                const currentStatus = existingData?.status;

                const planDetails = getPlanDetails(planType as PlanType);
                const notes = subscription.notes || {};
                
                console.log(`📝 Subscription notes:`, JSON.stringify(notes));

                // SOURCE OF TRUTH: invoice.paid is the single source of truth for credits.
                // It stamps invoicePaidAt when it runs. If that sentinel is present,
                // invoice.paid already ran — do NOT overwrite credits.
                // If absent, invoice.paid hasn't run yet — seed credits as a fallback
                // so the user is never left with 0. When invoice.paid eventually arrives,
                // it will unconditionally overwrite everything.
                const invoicePaidAlready = !!existingData?.invoicePaidAt;

                const updates: any = {
                    userId,
                    planType,
                    subscriptionId: subscription.id,
                    activatedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    ...(!invoicePaidAlready && {
                        credits: planDetails.credits,
                        initialCredits: planDetails.credits,
                        creditsUsed: 0,
                        lastPaymentId: payment?.id || null,
                        lastPaymentAmount: payment?.amount || 0,
                        lastPaymentDate: FieldValue.serverTimestamp(),
                    }),
                };

                // Status update — gated by priority (completed is terminal, cannot be overwritten)
                if (shouldUpdateStatus(currentStatus, 'active')) {
                    updates.status = 'active';
                }

                // Coupon fields — always write if coupon was applied
                if (notes.couponApplied === 'true') {
                    updates.couponApplied = 'true';
                    updates.couponCode = notes.couponCode || '';
                    updates.couponType = notes.couponType || '';
                    updates.affiliateId = notes.affiliateId || '';
                    updates.discountAmount = notes.discountAmount || '0';
                }

                // Only set createdAt if new document
                if (!existingDoc?.exists) {
                    updates.createdAt = FieldValue.serverTimestamp();
                }

                await syncSubscriptionToFirestore(subscription.id, userId, updates);

                console.log(`✅ Subscription activated: ${subscription.id}${currentStatus && !shouldUpdateStatus(currentStatus, 'active') ? ' (status not updated)' : ''}`);

                // Handle UPI upgrade flow - cancel old subscription after new one is confirmed
                if (notes.replacing_subscription_id && notes.upgrade_flow === 'true') {
                    const oldSubId = notes.replacing_subscription_id;
                    
                    console.log(`🔄 UPI Upgrade Flow: New subscription ${subscription.id} activated, cancelling old ${oldSubId}`);
                    
                    try {
                        const razorpay = new Razorpay({
                            key_id: RAZORPAY_CONFIG.keyId,
                            key_secret: RAZORPAY_CONFIG.keySecret,
                        });
                        
                        // Cancel old subscription at cycle end
                        await razorpay.subscriptions.cancel(oldSubId, 1); // 1 = cycle_end
                        
                        // Fetch old subscription to get next billing date
                        const oldSubDoc = await getSubscriptionWithFallback(oldSubId, userId);
                        const oldSubData = oldSubDoc?.data();
                        
                        // Calculate when old subscription will end
                        let willCancelAt = oldSubData?.nextBillingDate 
                            ? Timestamp.fromDate(new Date(oldSubData.nextBillingDate))
                            : Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
                        
                        // Update old subscription in Firestore
                        await syncSubscriptionToFirestore(oldSubId, userId, {
                            cancelAtCycleEnd: true,
                            cancelledAt: FieldValue.serverTimestamp(),
                            being_replaced_by: subscription.id,
                            willCancelAt: willCancelAt,
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                        
                        // Update new subscription with activation date
                        await syncSubscriptionToFirestore(subscription.id, userId, {
                            replacing_subscription_id: oldSubId,
                            will_activate_at: willCancelAt,
                        });
                        
                        console.log(`✅ Old subscription ${oldSubId} cancelled at cycle end (${willCancelAt.toDate().toISOString()})`);
                    } catch (error) {
                        console.error(`❌ Failed to cancel old subscription ${oldSubId}:`, error);
                        // Don't fail the webhook - log for manual review
                    }
                }

                // Record coupon usage in UserSubscription collection (first payment only)
                if (notes.couponApplied === 'true' && notes.couponCode) {
                    try {
                        const couponDocRef = db.collection('UserSubscription').doc(notes.couponCode);
                        const userEmail = notes.userEmail || '';
                        
                        await couponDocRef.set({
                            [`users.${userId}`]: {
                                email: userEmail,
                                planType,
                                subscriptionId: subscription.id,
                                subscribedAt: FieldValue.serverTimestamp(),
                            },
                            lastUsedAt: FieldValue.serverTimestamp(),
                            usageCount: FieldValue.increment(1),
                        }, { merge: true });

                        console.log(`🎫 Coupon usage recorded: ${notes.couponCode} → ${userEmail}`);
                    } catch (error) {
                        console.error('❌ Failed to record coupon usage:', error);
                    }
                }

                // Track affiliate commission for first payment only
                const affiliateId = notes.affiliateId;
                const couponCode = notes.couponCode;

                if (affiliateId && couponCode && payment?.amount) {
                    try {
                        const affiliateRef = db.collection('affiliates').doc(affiliateId);
                        const commissionRate = 10; // 10%
                        const planAmount = payment.amount; // in paise
                        const commissionEarnedPaise = Math.round((planAmount * commissionRate) / 100);
                        const commissionEarnedRupees = Math.round(commissionEarnedPaise / 100); // Convert to Rupees
                        const discountGiven = parseInt(notes.discountAmount || '0');

                        // Fetch user details
                        const userDoc = await db.collection('users').doc(userId).get();
                        const userData = userDoc.data();

                        // Use subscriptionId alone — only one commission per subscription
                        // Stored in sales_subscriptions subcollection (separate from MASIV orders)
                        const saleRef = affiliateRef.collection('sales_subscriptions').doc(subscription.id);

                        await db.runTransaction(async (t) => {
                            const existingSale = await t.get(saleRef);
                            if (existingSale.exists) {
                                console.log(`⚠️ Commission already recorded for ${subscription.id}, skipping`);
                                return;
                            }

                            t.set(saleRef, {
                                userId,
                                userEmail: userData?.email || notes.userEmail || '',
                                userName: userData?.displayName || userData?.name || notes.userName || '',
                                planType,
                                planAmount, // in paise
                                discountGiven, // in paise
                                commissionRate,
                                commissionEarned: commissionEarnedPaise, // in paise
                                commissionEarnedRupees, // in Rupees (for display)
                                couponCode,
                                subscriptionId: subscription.id,
                                status: 'pending',
                                cycleNumber: 1,
                                chargedAt: FieldValue.serverTimestamp(),
                            });

                            t.update(affiliateRef, {
                                totalSales: FieldValue.increment(1),
                                totalEarnings: FieldValue.increment(commissionEarnedRupees), // Store in Rupees
                                subscriptionSales: FieldValue.increment(1),
                                subscriptionEarnings: FieldValue.increment(commissionEarnedRupees),
                                lastSaleAt: FieldValue.serverTimestamp(),
                                updatedAt: FieldValue.serverTimestamp(),
                            });
                        });

                        console.log(`💰 First payment commission: ${affiliateId} earned ₹${commissionEarnedRupees} from ${userData?.email || userId}`);
                    } catch (error) {
                        console.error('❌ Failed to track affiliate commission:', error);
                    }
                }

                break;
            }

            case 'subscription.charged': {
                const subscription = payload.subscription.entity;
                const payment = payload.payment?.entity;
                const notes = subscription.notes || {};
                const userId = notes.userId;

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                // Atomically increment charge count using transaction
                const subscriptionRef = db.collection('razorpaySubscriptions').doc(subscription.id);
                let cycleNumber = 0;

                try {
                    await db.runTransaction(async (transaction) => {
                        const doc = await transaction.get(subscriptionRef);
                        cycleNumber = (doc.data()?.chargeCount ?? 0) + 1;
                        
                        transaction.update(subscriptionRef, {
                            chargeCount: cycleNumber,
                            lastPaymentId: payment?.id,
                            lastPaymentAmount: payment?.amount,
                            lastPaymentDate: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                    });

                    // Also update user's subscription subcollection
                    await db.collection('users').doc(userId)
                        .collection('subscriptions').doc(subscription.id)
                        .update({
                            chargeCount: cycleNumber,
                            lastPaymentId: payment?.id,
                            lastPaymentAmount: payment?.amount,
                            lastPaymentDate: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                        });

                    console.log(`✅ Renewal charged (cycle ${cycleNumber}): ${subscription.id}`);
                } catch (error) {
                    console.error('❌ Failed to increment charge count:', error);
                    return NextResponse.json({ success: false }, { status: 500 });
                }

                // No affiliate commission — renewals are full price, no discount
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
                const { userId, billingPeriod } = subscription.notes || {};

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                // For annual plans, keep access valid for 1 year from completion
                const expiresAt = billingPeriod === 'annual'
                    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                    : null;

                await syncSubscriptionToFirestore(subscription.id, userId, {
                    status: 'completed',
                    completedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    ...(expiresAt && { expiresAt }),
                });

                console.log(`✅ Subscription completed: ${subscription.id}${expiresAt ? ` (annual - expires ${expiresAt.toISOString()})` : ''}`);
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
                const currentStatus = subscriptionData?.status;

                if (!userId || !planType) {
                    console.error('❌ Missing userId or planType in subscription');
                    return NextResponse.json({ success: true });
                }

                const planDetails = getPlanDetails(planType as PlanType);

                // Track payment method from payment entity (reliable source)
                const paymentMethod = payment?.method; // 'card', 'upi', 'netbanking', 'emandate'

                // SOURCE OF TRUTH — invoice.paid unconditionally owns credits.
                // Stamps invoicePaidAt so all other events know not to overwrite after this.
                const updates: any = {
                    credits: planDetails.credits,
                    initialCredits: planDetails.credits,
                    creditsUsed: 0,
                    invoicePaidAt: FieldValue.serverTimestamp(),
                    lastPaymentId: payment?.id,
                    lastPaymentAmount: payment?.amount || 0,
                    lastPaymentDate: FieldValue.serverTimestamp(),
                    gracePeriodEndsAt: FieldValue.delete(),
                    lastPaymentFailure: FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp(),
                    // Track payment method (reliable source from payment entity)
                    ...(paymentMethod && {
                        payment_method: paymentMethod,
                        last_payment_method: paymentMethod,
                        payment_method_updated_at: FieldValue.serverTimestamp(),
                    }),
                };

                // Only update status if priority allows (don't reactivate cancelled subs)
                if (shouldUpdateStatus(currentStatus, 'active')) {
                    updates.status = 'active';
                }

                await syncSubscriptionToFirestore(subscriptionId, userId, updates);

                // If this user is a Pro Team admin, reset the shared credits pool too
                try {
                    const userDoc = await db.collection('users').doc(userId).get();
                    const userData = userDoc.data();
                    if (
                        userData?.proOrganisationId &&
                        userData?.proOrganisationRole === 'admin'
                    ) {
                        await db.collection('proOrganisations').doc(userData.proOrganisationId).update({
                            credits: planDetails.credits,
                            initialCredits: planDetails.credits,
                            creditsUsed: 0,
                            lastRenewalAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                        console.log(`🔄 Pro Team pool reset: ${userData.proOrganisationId} → ${planDetails.credits} credits`);
                    }
                } catch (proErr) {
                    console.error('❌ Failed to reset Pro Team pool on renewal:', proErr);
                }

                console.log(`💳 Invoice paid - Credits reset: ${subscriptionId}${currentStatus && !shouldUpdateStatus(currentStatus, 'active') ? ' (status not updated)' : ''}`);
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

                // Handle affiliate commission for MASIV orders
                if (orderData?.affiliateId && orderData?.affiliateCommission) {
                    try {
                        const affiliateRef = db.collection('affiliates').doc(orderData.affiliateId);
                        const customerPhone = orderData.whatsappNumber;
                        const commission = orderData.affiliateCommission;
                        const saleRef = affiliateRef.collection('sales_masiv').doc(customerPhone);

                        await db.runTransaction(async (t) => {
                            const existingSale = await t.get(saleRef);

                            if (existingSale.exists) {
                                const existing = existingSale.data() || {};
                                const existingOrders: string[] = existing.orders || [];

                                // Idempotency: skip if this orderId was already recorded
                                if (existingOrders.includes(orderId)) {
                                    console.log(`⚠️ MASIV commission already recorded for ${orderId}, skipping`);
                                    return;
                                }

                                t.update(saleRef, {
                                    totalPurchases: (existing.totalPurchases || 0) + 1,
                                    totalAmountPaid: (existing.totalAmountPaid || 0) + (orderData.finalAmount || 0),
                                    totalCommissionEarned: (existing.totalCommissionEarned || 0) + commission,
                                    orders: FieldValue.arrayUnion(orderId),
                                    lastPurchaseDate: FieldValue.serverTimestamp(),
                                    lastOrderId: orderId,
                                    lastAmountPaid: orderData.finalAmount || 0,
                                    lastCommission: commission,
                                    updatedAt: FieldValue.serverTimestamp(),
                                });
                            } else {
                                t.set(saleRef, {
                                    customerPhone,
                                    totalPurchases: 1,
                                    totalAmountPaid: orderData.finalAmount || 0,
                                    totalCommissionEarned: commission,
                                    orders: [orderId],
                                    firstPurchaseDate: FieldValue.serverTimestamp(),
                                    lastPurchaseDate: FieldValue.serverTimestamp(),
                                    lastOrderId: orderId,
                                    lastAmountPaid: orderData.finalAmount || 0,
                                    lastCommission: commission,
                                    updatedAt: FieldValue.serverTimestamp(),
                                });
                            }

                            t.update(affiliateRef, {
                                totalSales: FieldValue.increment(1),
                                totalEarnings: FieldValue.increment(commission),
                                masivSales: FieldValue.increment(1),
                                masivEarnings: FieldValue.increment(commission),
                                updatedAt: FieldValue.serverTimestamp(),
                            });
                        });

                        console.log(`💰 MASIV affiliate commission updated: ${orderData.affiliateId}, +₹${commission}`);
                    } catch (error) {
                        console.error('❌ Failed to track MASIV affiliate commission:', error);
                    }
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
