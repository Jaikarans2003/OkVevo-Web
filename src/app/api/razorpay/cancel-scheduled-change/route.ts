import { NextRequest, NextResponse } from 'next/server';
import { uidFromIdToken } from '@/lib/gateway/auth';
import { loadUserBillingSoT } from '@/lib/billing/userSoT';

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
