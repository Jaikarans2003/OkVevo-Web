import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { loadUserBillingSoT } from '@/lib/billing/userSoT';
import { childPurchaseResponse, rejectChildOrgPurchase } from '@/lib/orgs/orgContext';

export const runtime = 'nodejs';

/**
 * Once a downgrade replacement is authenticated, the current sub is cancelled at
 * cycle end. Razorpay cancel is irreversible (cannot renew/reactivate), so
 * undoing by cancelling only the pending replacement would leave the customer
 * with no plan. This route always refuses — the billing UI must not offer it.
 */
export async function POST(request: NextRequest) {
    const user = await uidFromIdToken(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const billing = await loadUserBillingSoT(user.uid);
    if (!billing.hasScheduledChanges) {
        return NextResponse.json(
            { error: 'No scheduled changes to cancel' },
            { status: 400 }
        );
    }

    return NextResponse.json(
        {
            error: 'Scheduled plan change cannot be undone',
            flow: 'undo_unavailable',
            message:
                'The current plan is already set to end at this cycle. Cancelling only the replacement would leave you with no plan.',
        },
        { status: 400 }
    );
}
