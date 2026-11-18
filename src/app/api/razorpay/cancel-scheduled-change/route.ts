import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { sql } from '@/lib/db/client';
import { getRazorpaySubscription, updateBillingByUserId, upsertRazorpaySubscription } from '@/lib/db/wallet';
import { RAZORPAY_CONFIG } from '@/config/razorpay';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { loadUserBillingSoT, razorpayErrorDescription } from '@/lib/billing/userSoT';

export const runtime = 'nodejs';

/**
 * Cancel a scheduled downgrade by cancelling the pending replacement subscription.
 * The current (old) subscription is not cancelled until the new one activates —
 * Razorpay cancel is irreversible (cannot renew/reactivate), so undo = cancel the
 * pending new sub only. If there is no pending replacement id, undo is unavailable.
 */
export async function POST(request: NextRequest) {
    const user = await uidFromIdToken(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const billing = await loadUserBillingSoT(user.uid);
        const subscriptionId = billing.razorpaySubscriptionId;

        if (!subscriptionId) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        if (!billing.hasScheduledChanges) {
            return NextResponse.json(
                { error: 'No scheduled changes to cancel' },
                { status: 400 }
            );
        }

        const oldSub = await getRazorpaySubscription(sql, subscriptionId);
        const pendingNewId =
            typeof oldSub?.beingReplacedBy === 'string' && oldSub.beingReplacedBy.length > 0
                ? oldSub.beingReplacedBy
                : null;

        if (!pendingNewId) {
            // No cancellable pending sub (e.g. old already cancel_at_cycle_end with no
            // replacement row). Razorpay cannot undo a cycle-end cancel.
            return NextResponse.json(
                {
                    error: 'Scheduled plan change cannot be undone',
                    flow: 'undo_unavailable',
                    message:
                        'The pending plan change has no cancellable replacement subscription.',
                },
                { status: 400 }
            );
        }

        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        // Pending start_at subs are authenticated/created — cycle_end cancel is rejected
        // ("no billing cycle is going on"). Immediate cancel only.
        await razorpay.subscriptions.cancel(pendingNewId, 0);

        await upsertRazorpaySubscription(sql, subscriptionId, user.uid, {
            beingReplacedBy: null,
        });
        await upsertRazorpaySubscription(sql, pendingNewId, user.uid, {
            status: 'cancelled',
            cancelledAt: new Date(),
        });

        await updateBillingByUserId(sql, user.uid, {
            hasScheduledChanges: false,
            scheduledChangeAt: null,
            scheduledPlanId: null,
            scheduledPlanType: null,
        });

        return NextResponse.json({
            success: true,
            message: 'Scheduled plan change cancelled successfully',
            subscription: {
                id: subscriptionId,
                has_scheduled_changes: false,
                cancelled_pending_subscription_id: pendingNewId,
            },
        });
    } catch (error: unknown) {
        console.error('❌ Cancel scheduled change error:', error);

        const statusCode =
            typeof error === 'object' &&
            error &&
            'statusCode' in error &&
            (error as { statusCode?: number }).statusCode === 400
                ? 400
                : 500;

        return NextResponse.json(
            {
                error:
                    statusCode === 400
                        ? razorpayErrorDescription(error)
                        : 'Failed to cancel scheduled change. Please try again.',
            },
            { status: statusCode }
        );
    }
}
