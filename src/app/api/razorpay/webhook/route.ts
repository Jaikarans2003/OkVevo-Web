import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { sql } from '@/lib/db/client';
import { withTx } from '@/lib/db/tx';
import {
    getBillingByUserId,
    getRazorpaySubscription,
    updateBillingByUserId,
    upsertRazorpaySubscription,
    type RazorpaySubscriptionData,
} from '@/lib/db/wallet';
import {
    RAZORPAY_CONFIG,
    PLACEHOLDER_CREDITS_PER_USD,
    SUBSCRIPTION_PLANS,
    getPlanDetails,
    isSelfServePlanType,
    lookupPlanById,
    parseBillingCurrency,
    type BillingCurrency,
} from '@/config/razorpay';
import { initialAllocationGrant, refreshAllocationIfDue } from '@/lib/billing/allocation';
import {
    allocationCreditDelta,
    creditsIncludedForCharge,
    hasScheduledPlanChange,
    proratedCreditGrant,
    subscriptionUpdatedRequestId,
} from '@/lib/billing/planChange';
import {
    claimWebhookEventId,
    releaseWebhookEventId,
} from '@/lib/billing/razorpayWebhookEvents';
import { verifyRazorpayWebhookSignature as verifyWebhookSignature } from '@/lib/billing/razorpayWebhookSig';
import {
    logStaleSubscriptionEvent,
    normalizePaymentMethod,
    shouldApplySubscriptionEvent,
    planStatusForSubscriptionEvent,
    userBillingFromData,
    type SubscriptionEventKind,
} from '@/lib/billing/userSoT';
import { grantCredits } from '@/lib/gateway/debit';

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

function shouldUpdateStatus(currentStatus: string | undefined | null, newStatus: string): boolean {
    if (!currentStatus) return true;

    // Never overwrite terminal states
    if (TERMINAL_STATES.includes(currentStatus)) return false;

    const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
    const newPriority = STATUS_PRIORITY[newStatus] || 0;

    // Strict greater than — same-priority events don't overwrite
    return newPriority > currentPriority;
}

async function patchUserBilling(uid: string, data: Record<string, unknown>): Promise<void> {
    await updateBillingByUserId(sql, uid, data);
}

async function loadWebhookUser(uid: string) {
    const billing = await getBillingByUserId(sql, uid);
    const data = (billing ?? {}) as unknown as Record<string, unknown>;
    return { data, billing: userBillingFromData(uid, data) };
}

function pointerDecision(
    uid: string,
    eventSubId: string,
    event: SubscriptionEventKind,
    billing: ReturnType<typeof userBillingFromData>,
    notes?: { upgrade_flow?: string; replacing_subscription_id?: string }
) {
    const decision = shouldApplySubscriptionEvent({
        eventSubId,
        currentSubId: billing.razorpaySubscriptionId,
        event,
        notes,
        currentPlanStatus: billing.planStatus,
    });
    if (!decision.apply) {
        logStaleSubscriptionEvent({
            uid,
            event,
            eventSubId,
            currentSubId: billing.razorpaySubscriptionId,
        });
    }
    return decision;
}

function unixToDate(unix: number | undefined | null): Date | null {
    if (typeof unix !== 'number' || !Number.isFinite(unix)) return null;
    return new Date(unix * 1000);
}

type ResolvedPlanMeta = {
    plan: string;
    planName: string;
    creditsIncluded: number;
    billingCycle: 'monthly' | 'yearly';
    currency: BillingCurrency;
};

function resolvePlanMeta(subscription: {
    plan_id?: string;
    notes?: Record<string, string | undefined>;
}): ResolvedPlanMeta | null {
    if (subscription.plan_id) {
        const byId = lookupPlanById(subscription.plan_id);
        if (byId) {
            return {
                plan: byId.name,
                planName: byId.planName,
                creditsIncluded: byId.creditsIncluded,
                billingCycle: byId.billingCycle,
                currency: byId.currency,
            };
        }
    }
    const planType = subscription.notes?.planType;
    if (planType && isSelfServePlanType(planType)) {
        const def = SUBSCRIPTION_PLANS[planType];
        const billingPeriod = subscription.notes?.billingPeriod;
        return {
            plan: planType,
            planName: def.name,
            creditsIncluded: def.creditsIncluded,
            billingCycle: billingPeriod === 'annual' ? 'yearly' : 'monthly',
            currency: parseBillingCurrency(subscription.notes?.currency, 'USD'),
        };
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

        const eventId = request.headers.get('x-razorpay-event-id')?.trim() || '';
        if (!eventId) {
            console.error('❌ Missing Razorpay event id');
            return NextResponse.json(
                { success: false, error: 'Missing event id' },
                { status: 400 }
            );
        }

        const event = JSON.parse(body);
        const { event: eventType, payload } = event;

        console.log(`📨 Razorpay webhook: ${eventType}`);

        const claimed = await claimWebhookEventId(eventId, typeof eventType === 'string' ? eventType : null);
        if (!claimed) {
            console.log(`↻ Duplicate Razorpay event ${eventId}; skipping`);
            return NextResponse.json({ success: true, duplicate: true });
        }

        try {
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
                    await withTx(async (tx) => {
                        const rows = await tx`
                            select coupon_code from razorpay_subscriptions where id = ${subscription.id} for update
                        `;
                        // Only seed coupon fields if not already written
                        if (rows[0]?.coupon_code) return;

                        await upsertRazorpaySubscription(tx, subscription.id, userId, {
                            couponCode: notes.couponCode,
                            couponType: notes.couponType || '',
                            affiliateId: notes.affiliateId || '',
                            discountAmount: notes.discountAmount || '0',
                            couponApplied: true,
                        });
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

                const existingData = await getRazorpaySubscription(sql, subscription.id);
                const currentStatus = existingData?.status;

                const planMeta = resolvePlanMeta(subscription);
                const notes = subscription.notes || {};

                console.log(`📝 Subscription notes:`, JSON.stringify(notes));

                // Legacy subscription-doc credits (Pro-Team / old UI). Two-bucket grants go via grantCredits.
                const invoicePaidAlready = !!existingData?.invoicePaidAt;

                const updates: Record<string, unknown> = {
                    planType,
                    activatedAt: new Date(),
                    ...(!invoicePaidAlready && planMeta && {
                        credits: planMeta.creditsIncluded,
                        initialCredits: planMeta.creditsIncluded,
                        creditsUsed: 0,
                        lastPaymentId: payment?.id || null,
                        lastPaymentAmount: payment?.amount || 0,
                        lastPaymentDate: new Date(),
                    }),
                };

                // Status update — gated by priority (completed is terminal, cannot be overwritten)
                if (shouldUpdateStatus(currentStatus, 'active')) {
                    updates.status = 'active';
                }

                // Coupon fields — always write if coupon was applied
                if (notes.couponApplied === 'true') {
                    updates.couponApplied = true;
                    updates.couponCode = notes.couponCode || '';
                    updates.couponType = notes.couponType || '';
                    updates.affiliateId = notes.affiliateId || '';
                    updates.discountAmount = notes.discountAmount || '0';
                }

                await upsertRazorpaySubscription(sql, subscription.id, userId, updates);

                console.log(`✅ Subscription activated: ${subscription.id}${currentStatus && !shouldUpdateStatus(currentStatus, 'active') ? ' (status not updated)' : ''}`);

                const webhookUser = await loadWebhookUser(userId);
                const activatedDecision = pointerDecision(
                    userId,
                    subscription.id,
                    'activated',
                    webhookUser.billing,
                    notes
                );
                const instrument = normalizePaymentMethod(payment?.method);

                // First-time / current-id recovery SET. UPI upgrade replacement ADD full new grant.
                if (activatedDecision.apply && planMeta) {
                    const currentStart = subscription.current_start
                        ? new Date(subscription.current_start * 1000)
                        : new Date();
                    const initial = initialAllocationGrant(planMeta.creditsIncluded, currentStart);
                    const periodEnd = unixToDate(subscription.current_end);
                    const addFullGrant =
                        activatedDecision.reason === 'replacement' &&
                        !hasScheduledPlanChange(webhookUser.data.hasScheduledChanges);

                    await grantCredits({
                        uid: userId,
                        amount: planMeta.creditsIncluded,
                        reason: 'subscription.activated',
                        bucket: 'allocation',
                        mode: addFullGrant ? 'add' : 'set',
                        // Include current_start so paused/halted → activated recovery can SET again.
                        requestId: `sub_activated_${subscription.id}_${subscription.current_start || '0'}`,
                        userPatch: {
                            planStatus: 'active',
                            plan: planMeta.plan,
                            planName: planMeta.planName,
                            billingCycle: planMeta.billingCycle,
                            creditsIncluded: planMeta.creditsIncluded,
                            currency: planMeta.currency,
                            razorpaySubscriptionId: subscription.id,
                            cancelAtPeriodEnd: false,
                            hasScheduledChanges: false,
                            scheduledChangeAt: null,
                            scheduledPlanId: null,
                            scheduledPlanType: null,
                            nextAllocationDate: initial.nextAllocationDate,
                            ...(periodEnd && { currentPeriodEnd: periodEnd }),
                            ...(instrument && { paymentMethod: instrument }),
                        },
                    });
                }

                // Cancel old UPI sub at cycle_end only after the replacement is applied.
                if (
                    activatedDecision.apply &&
                    notes.replacing_subscription_id &&
                    notes.upgrade_flow === 'true'
                ) {
                    const oldSubId = notes.replacing_subscription_id;

                    console.log(`🔄 UPI Upgrade Flow: New subscription ${subscription.id} activated, cancelling old ${oldSubId}`);

                    try {
                        const razorpay = new Razorpay({
                            key_id: RAZORPAY_CONFIG.keyId,
                            key_secret: RAZORPAY_CONFIG.keySecret,
                        });

                        // Cancel old subscription at cycle end
                        await razorpay.subscriptions.cancel(oldSubId, 1); // 1 = cycle_end

                        // Old subscription's `nextBillingDate` was never written anywhere in this
                        // webhook (dead field in the Firestore original) — always falls to the
                        // 30-day default below. Pure port: skip the dead lookup.
                        const willCancelAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                        // Update old subscription
                        await upsertRazorpaySubscription(sql, oldSubId, userId, {
                            cancelAtCycleEnd: true,
                            cancelledAt: new Date(),
                            beingReplacedBy: subscription.id,
                            willCancelAt,
                        });

                        // Update new subscription with activation date
                        await upsertRazorpaySubscription(sql, subscription.id, userId, {
                            replacingSubscriptionId: oldSubId,
                            willActivateAt: willCancelAt,
                        });

                        console.log(`✅ Old subscription ${oldSubId} cancelled at cycle end (${willCancelAt.toISOString()})`);
                    } catch (error) {
                        console.error(`❌ Failed to cancel old subscription ${oldSubId}:`, error);
                        // Don't fail the webhook - log for manual review
                    }
                }

                // Coupon usage (UserSubscription) and affiliate commission tracking
                // (affiliates/sales_subscriptions) are a dead product surface —
                // deferred delete phase d. No-op here (pure port).

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

                // Atomically increment charge count (single table now — was a dual write).
                let cycleNumber = 0;
                try {
                    await withTx(async (tx) => {
                        const rows = await tx`
                            select charge_count from razorpay_subscriptions where id = ${subscription.id} for update
                        `;
                        cycleNumber = (Number(rows[0]?.charge_count) || 0) + 1;
                        await upsertRazorpaySubscription(tx, subscription.id, userId, {
                            chargeCount: cycleNumber,
                            lastPaymentId: payment?.id,
                            lastPaymentAmount: payment?.amount,
                            lastPaymentDate: new Date(),
                        });
                    });

                    console.log(`✅ Renewal charged (cycle ${cycleNumber}): ${subscription.id}`);
                } catch (error) {
                    console.error('❌ Failed to increment charge count:', error);
                    return NextResponse.json({ success: false }, { status: 500 });
                }

                const planMeta = resolvePlanMeta(subscription);
                const periodEnd = unixToDate(subscription.current_end);
                const webhookUser = await loadWebhookUser(userId);
                const chargedDecision = pointerDecision(
                    userId,
                    subscription.id,
                    'charged',
                    webhookUser.billing,
                    notes
                );
                if (!chargedDecision.apply) break;

                const userData = webhookUser.data;
                const instrument = normalizePaymentMethod(payment?.method);

                const statusPatch: Record<string, unknown> = {};
                if (userData.planStatus !== 'active') statusPatch.planStatus = 'active';
                if (periodEnd) statusPatch.currentPeriodEnd = periodEnd;
                if (instrument) statusPatch.paymentMethod = instrument;
                if (Object.keys(statusPatch).length > 0) {
                    await patchUserBilling(userId, statusPatch);
                }

                const refreshPatch = refreshAllocationIfDue({
                    planStatus: 'active',
                    creditsIncluded: creditsIncludedForCharge(
                        planMeta?.creditsIncluded,
                        userData.creditsIncluded
                    ),
                    allocationBalance: userData.allocationBalance as number | undefined,
                    nextAllocationDate: userData.nextAllocationDate as Date | null | undefined,
                });
                if (refreshPatch) {
                    await grantCredits({
                        uid: userId,
                        amount: refreshPatch.allocationBalance,
                        reason: 'subscription.charged',
                        bucket: 'allocation',
                        requestId: `sub_charged_${subscription.id}_${cycleNumber}`,
                        userPatch: {
                            nextAllocationDate: refreshPatch.nextAllocationDate,
                            planStatus: 'active',
                            ...(periodEnd && { currentPeriodEnd: periodEnd }),
                            ...(instrument && { paymentMethod: instrument }),
                        },
                    });
                }

                // No affiliate commission — renewals are full price, no discount
                break;
            }

            case 'subscription.updated': {
                const subscription = payload.subscription.entity;
                const notes = subscription.notes || {};
                const userId = notes.userId;

                if (!userId) {
                    console.error('❌ Missing userId');
                    return NextResponse.json({ success: false }, { status: 400 });
                }

                const webhookUser = await loadWebhookUser(userId);
                const updatedDecision = pointerDecision(
                    userId,
                    subscription.id,
                    'updated',
                    webhookUser.billing,
                    notes
                );
                if (!updatedDecision.apply) break;

                if (hasScheduledPlanChange(subscription.has_scheduled_changes)) {
                    const scheduledAt = unixToDate(subscription.change_scheduled_at);
                    await patchUserBilling(userId, {
                        hasScheduledChanges: true,
                        ...(scheduledAt && { scheduledChangeAt: scheduledAt }),
                    });
                    console.log(`📅 Plan change scheduled: ${subscription.id}`);
                    break;
                }

                const planMeta = resolvePlanMeta(subscription);
                if (!planMeta) {
                    console.error(`❌ subscription.updated: unknown plan_id ${subscription.plan_id}`);
                    break;
                }

                const userData = webhookUser.data;
                const delta = allocationCreditDelta(
                    userData.creditsIncluded,
                    planMeta.creditsIncluded
                );
                const nowUnix =
                    typeof event.created_at === 'number'
                        ? event.created_at
                        : Math.floor(Date.now() / 1000);
                const grant = proratedCreditGrant(
                    delta,
                    (subscription.current_end ?? 0) - nowUnix,
                    (subscription.current_end ?? 0) - (subscription.current_start ?? 0)
                );
                const periodEnd = unixToDate(subscription.current_end);
                const requestId = subscriptionUpdatedRequestId(
                    subscription.id,
                    subscription.updated_at,
                    event.created_at
                );

                await grantCredits({
                    uid: userId,
                    amount: grant,
                    reason: 'subscription.updated',
                    bucket: 'allocation',
                    mode: 'add',
                    requestId,
                    userPatch: {
                        plan: planMeta.plan,
                        planName: planMeta.planName,
                        creditsIncluded: planMeta.creditsIncluded,
                        billingCycle: planMeta.billingCycle,
                        currency: planMeta.currency,
                        planStatus: 'active',
                        razorpaySubscriptionId: subscription.id,
                        hasScheduledChanges: false,
                        scheduledChangeAt: null,
                        scheduledPlanId: null,
                        scheduledPlanType: null,
                        ...(periodEnd && { currentPeriodEnd: periodEnd }),
                    },
                });

                console.log(
                    `✅ Subscription updated: ${subscription.id} plan=${planMeta.plan} delta=+${grant}`
                );
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

                await upsertRazorpaySubscription(sql, subscription.id, userId, {
                    status: 'pending',
                    gracePeriodEndsAt: gracePeriodEnds,
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

                await upsertRazorpaySubscription(sql, subscription.id, userId, {
                    status: 'halted',
                    haltedAt: new Date(),
                });

                const haltedUser = await loadWebhookUser(userId);
                if (pointerDecision(userId, subscription.id, 'halted', haltedUser.billing, subscription.notes).apply) {
                    await patchUserBilling(userId, { planStatus: 'halted' });
                }

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

                await upsertRazorpaySubscription(sql, subscription.id, userId, {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                });

                const cancelledUser = await loadWebhookUser(userId);
                if (pointerDecision(userId, subscription.id, 'cancelled', cancelledUser.billing, subscription.notes).apply) {
                    await patchUserBilling(userId, {
                        planStatus: 'cancelled',
                        cancelAtPeriodEnd: false,
                    });
                }

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

                await upsertRazorpaySubscription(sql, subscription.id, userId, {
                    status: 'paused',
                    pausedAt: new Date(),
                });

                const pausedUser = await loadWebhookUser(userId);
                if (pointerDecision(userId, subscription.id, 'paused', pausedUser.billing, subscription.notes).apply) {
                    await patchUserBilling(userId, { planStatus: 'paused' });
                }

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

                await upsertRazorpaySubscription(sql, subscription.id, userId, {
                    status: 'active',
                    resumedAt: new Date(),
                });

                const resumedUser = await loadWebhookUser(userId);
                if (pointerDecision(userId, subscription.id, 'resumed', resumedUser.billing, subscription.notes).apply) {
                    const planStatus = planStatusForSubscriptionEvent('resumed');
                    if (planStatus) {
                        await patchUserBilling(userId, { planStatus });
                    }
                }

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

                await upsertRazorpaySubscription(sql, subscription.id, userId, {
                    status: 'completed',
                    completedAt: new Date(),
                    ...(expiresAt && { expiresAt }),
                });

                const completedUser = await loadWebhookUser(userId);
                if (pointerDecision(userId, subscription.id, 'completed', completedUser.billing, subscription.notes).apply) {
                    const planStatus = planStatusForSubscriptionEvent('completed');
                    if (planStatus) {
                        await patchUserBilling(userId, { planStatus });
                    }
                }

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

                const subscriptionData: RazorpaySubscriptionData | undefined =
                    await getRazorpaySubscription(sql, subscriptionId);

                if (!subscriptionData) {
                    console.error(`❌ Subscription not found: ${subscriptionId}`);
                    return NextResponse.json({ success: true });
                }

                const userId = subscriptionData.userId;
                const planType = subscriptionData.planType;
                const currentStatus = subscriptionData.status;

                if (!userId || !planType) {
                    console.error('❌ Missing userId or planType in subscription');
                    return NextResponse.json({ success: true });
                }

                const planDetails = isSelfServePlanType(planType)
                    ? getPlanDetails(planType)
                    : null;
                const legacyCredits = planDetails?.creditsIncluded ?? 0;

                // Track payment method from payment entity (reliable source)
                const paymentMethod = payment?.method; // 'card', 'upi', 'netbanking', 'emandate'

                // Legacy subscription-doc credits only — do NOT grant allocationBalance,
                // topUpBalance, or creditBalance here (two-bucket grants are webhook/cron only).
                const updates: Record<string, unknown> = {
                    credits: legacyCredits,
                    initialCredits: legacyCredits,
                    creditsUsed: 0,
                    invoicePaidAt: new Date(),
                    lastPaymentId: payment?.id,
                    lastPaymentAmount: payment?.amount || 0,
                    lastPaymentDate: new Date(),
                    gracePeriodEndsAt: null,
                    lastPaymentFailure: null,
                    // Track payment method (reliable source from payment entity)
                    ...(paymentMethod && {
                        paymentMethod,
                        paymentMethodUpdatedAt: new Date(),
                    }),
                };

                // Only update status if priority allows (don't reactivate cancelled subs)
                if (shouldUpdateStatus(currentStatus, 'active')) {
                    updates.status = 'active';
                }

                await upsertRazorpaySubscription(sql, subscriptionId, userId, updates);

                const invoiceUser = await loadWebhookUser(userId);
                const instrument = normalizePaymentMethod(paymentMethod);
                if (
                    instrument &&
                    invoiceUser.billing.razorpaySubscriptionId === subscriptionId
                ) {
                    await patchUserBilling(userId, {
                        paymentMethod: instrument,
                    });
                }

                // Pro Team shared-pool reset (proOrganisations) is a dead product
                // surface — deferred delete phase d. No-op here.

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

                const subscriptionData = await getRazorpaySubscription(sql, subscriptionId);

                if (!subscriptionData) {
                    console.error(`❌ Subscription not found: ${subscriptionId}`);
                    return NextResponse.json({ success: true });
                }

                const userId = subscriptionData.userId;

                if (!userId) {
                    console.error('❌ Missing userId in subscription');
                    return NextResponse.json({ success: true });
                }

                // Set grace period
                const gracePeriodEnds = new Date();
                gracePeriodEnds.setDate(gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS);

                await upsertRazorpaySubscription(sql, subscriptionId, userId, {
                    gracePeriodEndsAt: gracePeriodEnds,
                    lastPaymentFailure: {
                        paymentId: payment?.id || 'unknown',
                        errorCode: payment?.error_code || 'unknown',
                        errorDescription: payment?.error_description || 'Payment failed',
                        failedAt: new Date().toISOString(),
                    },
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

            // ========== ONE-OFF PAYMENT EVENTS ==========

            case 'payment.captured': {
                const payment = payload.payment.entity;
                const paymentId = payment.id;
                const payNotes = payment.notes || {};
                const capturedMethod = normalizePaymentMethod(payment.method);
                const capturedSubId =
                    typeof payment.subscription_id === 'string' ? payment.subscription_id : null;
                const capturedUid =
                    typeof payNotes.userId === 'string' && payNotes.userId
                        ? payNotes.userId
                        : typeof payNotes.uid === 'string' && payNotes.uid
                          ? payNotes.uid
                          : null;
                if (capturedUid && capturedSubId && capturedMethod) {
                    const capturedUser = await loadWebhookUser(capturedUid);
                    if (capturedUser.billing.razorpaySubscriptionId === capturedSubId) {
                        await patchUserBilling(capturedUid, {
                            paymentMethod: capturedMethod,
                        });
                    }
                }

                // Nia add-credits via Payment Link (no order_id).
                if (payNotes.purpose === 'nia_add_credits' && payNotes.uid) {
                    const amountUsd = payNotes.amountUsd
                        ? Number(payNotes.amountUsd)
                        : payment.amount / 100;
                    const credits = Math.round(amountUsd * PLACEHOLDER_CREDITS_PER_USD);
                    if (Number.isFinite(credits) && credits > 0) {
                        await grantCredits({
                            uid: payNotes.uid,
                            amount: credits,
                            reason: 'nia_add_credits',
                            bucket: 'topUp',
                            requestId: `rp_${paymentId}`,
                        });
                        console.log(`✅ Top-up credits granted: ${payNotes.uid} +${credits}`);
                    }
                }

                // MASIV one-time payment orders, coupon usage, and affiliate
                // commission tracking are a dead product surface — deferred
                // delete phase d. No-op here (pure port).
                break;
            }

            case 'payment.failed': {
                // MASIV order failure handling (order status + userPurchaseHistory
                // rollback) is a dead product surface — deferred delete phase d.
                break;
            }

            default:
                console.log(`⚠️ Unhandled event: ${eventType}`);
        }

        return NextResponse.json({ success: true });
        } catch (handlerErr) {
            await releaseWebhookEventId(eventId);
            throw handlerErr;
        }

    } catch (error: any) {
        console.error('❌ Webhook error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
