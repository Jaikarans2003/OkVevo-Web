import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

import { RAZORPAY_CONFIG, PLACEHOLDER_CREDITS_PER_USD } from '@/config/razorpay';
import { auth } from '@/lib/firebase-admin';
import { gatewayIdToken } from '@/lib/gateway/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const token = gatewayIdToken(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let uid: string;
    let customerEmail = '';
    let customerName = 'Nia user';
    try {
        const decoded = await auth.verifyIdToken(token);
        uid = decoded.uid;
        customerEmail = decoded.email || '';
        customerName = decoded.name || customerName;
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { amountUsd?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 5 || amountUsd > 100) {
        return NextResponse.json(
            { error: 'amountUsd must be a number between 5 and 100' },
            { status: 400 }
        );
    }

    const credits = Math.round(amountUsd * PLACEHOLDER_CREDITS_PER_USD);
    const amountCents = Math.round(amountUsd * 100);

    const razorpay = new Razorpay({
        key_id: RAZORPAY_CONFIG.keyId,
        key_secret: RAZORPAY_CONFIG.keySecret,
    });

    const link = await razorpay.paymentLink.create({
        amount: amountCents,
        currency: 'USD',
        accept_partial: false,
        description: 'Nia credits top-up',
        customer: {
            name: customerName,
            email: customerEmail || `${uid}@users.okvevo.com`,
        },
        notes: {
            uid,
            purpose: 'nia_add_credits',
            amountUsd: String(amountUsd),
        },
    });

    return NextResponse.json({
        shortUrl: link.short_url,
        paymentLinkId: link.id,
        credits,
    });
}
