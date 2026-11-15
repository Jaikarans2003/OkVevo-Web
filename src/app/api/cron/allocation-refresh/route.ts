// Wire Cloud Scheduler daily ~00:10 UTC → POST this URL with Authorization: Bearer CRON_SECRET

import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { refreshAllocationIfDue } from '@/lib/billing/allocation';
import { sql } from '@/lib/db/client';
import { billingRowToData } from '@/lib/db/wallet';
import { grantCredits } from '@/lib/gateway/debit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const secret = env.cronSecret;
    const authHeader = request.headers.get('authorization') || '';
    const token = /^Bearer\s+(\S+)/i.exec(authHeader.trim())?.[1];
    if (!secret || !token || token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    let scanned = 0;
    let refreshed = 0;

    // ponytail: no Firestore-API page limit on Postgres — one query over the
    // (bounded, paying-user-sized) due set, not a 200-row keyset cursor.
    const rows = await sql`
        select * from billing_accounts
        where plan_status = 'active' and next_allocation_date <= ${now}
    `;
    for (const row of rows) {
        scanned++;
        const user = billingRowToData(row as Record<string, unknown>);
        if (!user) continue;
        const patch = refreshAllocationIfDue({
            planStatus: user.planStatus,
            creditsIncluded: user.creditsIncluded,
            allocationBalance: user.allocationBalance,
            nextAllocationDate: user.nextAllocationDate,
        });
        if (!patch) continue;

        const nextAllocationDate = patch.nextAllocationDate;
        await grantCredits({
            uid: user.ownerUserId,
            amount: patch.allocationBalance,
            reason: 'cron.allocation_refresh',
            bucket: 'allocation',
            requestId: `cron_alloc_${user.ownerUserId}_${nextAllocationDate.getTime()}`,
            userPatch: { nextAllocationDate },
        });
        refreshed++;
    }

    return NextResponse.json({ refreshed, scanned });
}
