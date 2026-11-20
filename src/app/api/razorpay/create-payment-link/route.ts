import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

import { RAZORPAY_CONFIG, PLACEHOLDER_CREDITS_PER_USD, parseBillingCurrency } from '@/config/razorpay';
import { topUpAmountMinorUnits } from '@/lib/billing/currency';
import { isEntitled } from '@/lib/billing/entitlement';
import { loadBillingSoTByAccountId, razorpayErrorDescription } from '@/lib/billing/userSoT';
import { sql } from '@/lib/db/client';
import { uidFromIdToken } from '@/lib/gateway/auth';
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

    const uid = user.uid;
    const customerEmail = user.email;
    const customerName = user.name;

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

    try {
        const billing = await loadBillingSoTByAccountId(uid, paying.billingAccountId);
        if (!isEntitled(billing)) {
            return NextResponse.json(
                { error: 'plan_not_active', message: 'Subscription is not active' },
                { status: 403 }
            );
        }
        const currency = parseBillingCurrency(billing.currency, 'USD');
        const credits = Math.round(amountUsd * PLACEHOLDER_CREDITS_PER_USD);
        const amountMinor = topUpAmountMinorUnits(amountUsd, currency);

        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        const link = await razorpay.paymentLink.create({
            amount: amountMinor,
            currency,
            accept_partial: false,
            description: 'OkVevo credits top-up',
            customer: {
                name: customerName,
                email: customerEmail || `${uid}@users.okvevo.com`,
            },
            notes: {
                uid,
                purpose: 'nia_add_credits',
                amountUsd: String(amountUsd),
                currency,
                billing_account_id: paying.billingAccountId,
            },
        });

        return NextResponse.json({
            shortUrl: link.short_url,
            paymentLinkId: link.id,
            credits,
            currency,
        });
    } catch (error: unknown) {
        console.error('❌ Payment link create error:', error);
        return NextResponse.json(
            { error: razorpayErrorDescription(error) },
            { status: 502 }
        );
    }
}
