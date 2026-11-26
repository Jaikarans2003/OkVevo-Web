import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { sql } from '@/lib/db/client';
import { withTx } from '@/lib/db/tx';
import { upsertRazorpaySubscription } from '@/lib/db/wallet';
import { writeAuditLog } from '@/lib/orgs/auditLog';
import {
    RAZORPAY_CONFIG,
    getPlanDetailsByPeriod,
    getRazorpayPlanId,
    isSelfServePlanType,
    parseBillingCurrency,
    type SelfServePlanType,
} from '@/config/razorpay';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { isUpdatablePlanStatus, loadBillingSoTByAccountId, razorpayErrorDescription } from '@/lib/billing/userSoT';
import { isSamePlan, scheduleChangeAt } from '@/lib/billing/planChange';
import {
    childPurchaseResponse,
    orgPublicIdFromRequest,
    rejectChildOrgPurchase,
    resolvePayingWallet,
} from '@/lib/orgs/orgContext';

export const runtime = 'nodejs';

/**
 * Plan change for every payment method (Razorpay India: plan change = new subscription).
 * Upgrade → new sub charged now; old cancelled at cycle end on activation (webhook).
 * Downgrade → new sub with start_at = period end; old cancelled at cycle end only after
 * the replacement's subscription.authenticated (webhook). Creating alone must not cancel —
 * an abandoned Checkout would otherwise end the current plan with no replacement
 * (Razorpay cancel cannot be undone). Credits SET on the new sub's first charge.
 */
export async function POST(request: NextRequest) {
    const user = await uidFromIdToken(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paying = await resolvePayingWallet(sql, {
        userId: user.uid,
        orgPublicId: orgPublicIdFromRequest(request),
        email: user.email,
    });
    if (!paying.ok) {
        return NextResponse.json(
            { error: paying.code, code: paying.code },
            { status: paying.status }
        );
    }

    const childBlock = await rejectChildOrgPurchase(sql, {
        req: request,
        userId: user.uid,
        email: user.email,
    });
    if (childBlock.blocked) {
        const r = childPurchaseResponse(childBlock);
        return NextResponse.json(r.body, { status: r.status });
    }

    try {
        let body: { newPlanType?: unknown; newBillingPeriod?: unknown };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        const newPlanType = body.newPlanType;
        const newBillingPeriod = body.newBillingPeriod === 'annual' ? 'annual' : 'monthly';
        const userId = user.uid;

        if (!newPlanType || typeof newPlanType !== 'string') {
            return NextResponse.json(
                { error: 'Missing required field: newPlanType' },
                { status: 400 }
            );
        }

        if (!isSelfServePlanType(newPlanType)) {
            return NextResponse.json(
                { error: 'Invalid plan type. Must be starter, pro, or max' },
                { status: 400 }
            );
        }

        const billing = await loadBillingSoTByAccountId(userId, paying.billingAccountId);
        const oldSubscriptionId = billing.razorpaySubscriptionId;

        if (!oldSubscriptionId) {
            return NextResponse.json(
                { error: 'Old subscription not found' },
                { status: 404 }
            );
        }

        if (!isUpdatablePlanStatus(billing.planStatus)) {
            return NextResponse.json(
                { error: 'Subscription must be active or authenticated to update' },
                { status: 400 }
            );
        }

        if (billing.hasScheduledChanges) {
            return NextResponse.json(
                {
                    error: 'Subscription already has a pending plan change',
                    message: 'A plan change is already scheduled for the end of this billing cycle.',
                    scheduled_plan_type: billing.scheduledPlanType,
                },
                { status: 400 }
            );
        }

        if (isSamePlan(billing.plan, billing.billingCycle, newPlanType, newBillingPeriod)) {
            return NextResponse.json(
                { error: 'You are already on this plan' },
                { status: 400 }
            );
        }

        const when = scheduleChangeAt(
            billing.plan,
            billing.billingCycle,
            newPlanType,
            newBillingPeriod
        );
        const planCurrency = parseBillingCurrency(billing.currency, 'USD');
        const razorpayPlanId = getRazorpayPlanId(
            newPlanType as SelfServePlanType,
            newBillingPeriod,
            planCurrency
        );

        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const planDetails = getPlanDetailsByPeriod(
            newPlanType as SelfServePlanType,
            newBillingPeriod,
            planCurrency
        );

        const changeScheduledAt =
            billing.currentPeriodEnd ??
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const notes = {
            userId,
            planType: newPlanType,
            billingPeriod: newBillingPeriod,
            currency: planCurrency,
            billing_account_id: paying.billingAccountId,
            userEmail: user.email || '',
            userName: user.name || '',
            replacing_subscription_id: oldSubscriptionId,
            upgrade_flow: 'true',
            schedule_change_at: when,
        };

        // Downgrade: first charge at period end. Upgrade: charge on auth (no start_at).
        const newSubscription = await razorpay.subscriptions.create({
            plan_id: razorpayPlanId,
            total_count: newBillingPeriod === 'annual' ? 1 : 12,
            quantity: 1,
            customer_notify: 1,
            notes,
            ...(when === 'cycle_end'
                ? { start_at: Math.floor(changeScheduledAt.getTime() / 1000) }
                : {}),
        });

        // Link rows only. Downgrade cycle-end cancel + scheduled-change fields land in
        // the webhook on subscription.authenticated (after Checkout auth), not here.
        await withTx(async (tx) => {
            await upsertRazorpaySubscription(tx, oldSubscriptionId, paying.billingAccountId, {
                beingReplacedBy: newSubscription.id,
            });
            await upsertRazorpaySubscription(tx, newSubscription.id, paying.billingAccountId, {
                replacingSubscriptionId: oldSubscriptionId,
                planType: newPlanType,
                ...(when === 'cycle_end' && { willActivateAt: changeScheduledAt }),
            });
            if (paying.orgId) {
                await writeAuditLog(tx, {
                    orgId: paying.orgId,
                    actorUserId: user.uid,
                    action: 'plan.change',
                    targetType: 'organization',
                    targetId: paying.orgId,
                    metadata: { fromPlan: billing.plan, toPlan: newPlanType },
                });
            }
        });

        return NextResponse.json({
            success: true,
            flow: 'cancel_and_create',
            scheduleChangeAt: when,
            message:
                when === 'cycle_end'
                    ? 'Authorize the new plan now. It starts at the end of your current billing cycle — you will not be charged until then.'
                    : 'New subscription created. Please complete payment authorization.',
            requiresNewAuth: true,
            newSubscriptionId: newSubscription.id,
            oldSubscriptionId,
            planId: razorpayPlanId,
            amount: planDetails.price,
            currency: planDetails.currency,
            razorpayKeyId: RAZORPAY_CONFIG.keyId,
            shortUrl: newSubscription.short_url,
            ...(when === 'cycle_end' && {
                scheduledChangeAt: changeScheduledAt.toISOString(),
            }),
            newPlanType,
            currentPlanType: billing.plan,
            newPlanDetails: {
                name: planDetails.name,
                price: planDetails.price,
                period: planDetails.period,
            },
        });
    } catch (error: unknown) {
        console.error('❌ Plan change (new subscription) error:', error);
        return NextResponse.json(
            {
                error: razorpayErrorDescription(error) || 'Failed to create plan-change subscription',
            },
            { status: 500 }
        );
    }
}
