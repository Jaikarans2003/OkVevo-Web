// Wire Cloud Scheduler daily ~00:10 UTC → POST this URL with Authorization: Bearer CRON_SECRET

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

import { env } from '@/config/env';
import { refreshAllocationIfDue } from '@/lib/billing/allocation';
import { db } from '@/lib/firebase-admin';
import { grantCredits } from '@/lib/gateway/debit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const secret = env.cronSecret;
    const authHeader = request.headers.get('authorization') || '';
    const token = /^Bearer\s+(\S+)/i.exec(authHeader.trim())?.[1];
    if (!secret || !token || token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Timestamp.now();
    let scanned = 0;
    let refreshed = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (true) {
        let query = db
            .collection('users')
            .where('planStatus', '==', 'active')
            .where('nextAllocationDate', '<=', now)
            .limit(200);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snap = await query.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
            scanned++;
            const user = doc.data();
            const patch = refreshAllocationIfDue({
                planStatus: user.planStatus,
                creditsIncluded: user.creditsIncluded,
                allocationBalance: user.allocationBalance,
                nextAllocationDate: user.nextAllocationDate,
            });
            if (!patch) continue;

            await grantCredits({
                uid: doc.id,
                amount: patch.allocationBalance,
                reason: 'cron.allocation_refresh',
                bucket: 'allocation',
                requestId: `cron_alloc_${doc.id}_${patch.nextAllocationDate.toMillis()}`,
                userPatch: { nextAllocationDate: patch.nextAllocationDate },
            });
            refreshed++;
        }

        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < 200) break;
    }

    return NextResponse.json({ refreshed, scanned });
}
