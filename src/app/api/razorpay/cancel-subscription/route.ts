import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { sql } from '@/lib/db/client';
import { updateBillingById } from '@/lib/db/wallet';
import { RAZORPAY_CONFIG } from '@/config/razorpay';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { isCancellablePlanStatus, loadBillingSoTByAccountId } from '@/lib/billing/userSoT';
import {
    childPurchaseResponse,
    orgPublicIdFromRequest,
    rejectChildOrgPurchase,
    resolvePayingWallet,
} from '@/lib/orgs/orgContext';

export const runtime = 'nodejs';

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
        const billing = await loadBillingSoTByAccountId(user.uid, paying.billingAccountId);
        const subscriptionId = billing.razorpaySubscriptionId;

        if (!subscriptionId) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        if (!isCancellablePlanStatus(billing.planStatus)) {
            return NextResponse.json(
                { error: billing.planStatus === 'cancelled'
                    ? 'Subscription is already cancelled'
                    : 'Only active subscriptions can be cancelled' },
                { status: 400 }
            );
        }

        if (billing.cancelAtPeriodEnd) {
            return NextResponse.json(
                { error: 'Subscription is already scheduled for cancellation' },
                { status: 400 }
            );
        }

        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const cancelledSubscription = await razorpay.subscriptions.cancel(
            subscriptionId,
            1
        );

        const willCancelAt = billing.currentPeriodEnd
            ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await updateBillingById(sql, paying.billingAccountId, { cancelAtPeriodEnd: true });

        return NextResponse.json({
            success: true,
            message: 'Subscription scheduled for cancellation at end of billing cycle',
            willCancelAt: willCancelAt.toISOString(),
            subscription: {
                id: subscriptionId,
                status: cancelledSubscription.status,
                cancelAtCycleEnd: true,
            },
        });
    } catch (error: any) {
        console.error('Error cancelling subscription:', error);

        if (error.statusCode === 400) {
            return NextResponse.json(
                { error: error.error?.description || 'Invalid request to Razorpay' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to cancel subscription. Please try again.' },
            { status: 500 }
        );
    }
}
