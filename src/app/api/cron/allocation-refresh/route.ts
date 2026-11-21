// Wire Cloud Scheduler daily ~00:10 UTC → POST this URL with Authorization: Bearer CRON_SECRET
// Also runs 1-year additional-credit expiry (plan §5.2) — no separate scheduler job.

import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { refreshAllocationIfDue } from '@/lib/billing/allocation';
import { sql } from '@/lib/db/client';
import { withTx } from '@/lib/db/tx';
import { billingRowToData } from '@/lib/db/wallet';
import { grantCredits } from '@/lib/gateway/debit';
import {
  expireAllocationLotsForWallet,
  listWalletsWithDueAllocationLots,
} from '@/lib/billing/expireAllocationLots';
import {
  expireAdditionalForWallet,
  listWalletsWithDueAdditional,
} from '@/lib/orgs/expireAdditional';

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
    let expiredWallets = 0;
    let expiredCredits = 0;
    let expiredAllocLots = 0;

    // --- 1-year additional expiry (before allocation SET so balance is current) ---
    const dueWalletIds = await listWalletsWithDueAdditional(sql, now);
    for (const billingAccountId of dueWalletIds) {
        const result = await withTx((tx) => expireAdditionalForWallet(tx, billingAccountId, now));
        if (result.expired > 0) {
            expiredWallets++;
            expiredCredits += result.expired;
        }
    }

    // --- allocation lot expiry (cancelled plan end; per-lot expires_at) ---
    const dueAllocWallets = await listWalletsWithDueAllocationLots(sql, now);
    for (const billingAccountId of dueAllocWallets) {
        const result = await withTx((tx) =>
            expireAllocationLotsForWallet(tx, billingAccountId, now)
        );
        expiredAllocLots += result.expired;
    }

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
        const lotOpts = {
            razorpaySubscriptionId: user.razorpaySubscriptionId,
            expiresAt: user.currentPeriodEnd,
        };
        // Org wallets (post-upgrade) have null owner_user_id — grant by billing id.
        if (user.ownerUserId) {
            await grantCredits({
                uid: user.ownerUserId,
                amount: patch.allocationBalance,
                reason: 'cron.allocation_refresh',
                bucket: 'allocation',
                requestId: `cron_alloc_${user.ownerUserId}_${nextAllocationDate.getTime()}`,
                userPatch: { nextAllocationDate },
                ...lotOpts,
            });
        } else {
            await grantCredits({
                billingAccountId: user.id,
                amount: patch.allocationBalance,
                reason: 'cron.allocation_refresh',
                bucket: 'allocation',
                requestId: `cron_alloc_${user.id}_${nextAllocationDate.getTime()}`,
                userPatch: { nextAllocationDate },
                ...lotOpts,
            });
        }
        refreshed++;
    }

    return NextResponse.json({
        refreshed,
        scanned,
        expiredWallets,
        expiredCredits,
        expiredAllocLots,
    });
}
