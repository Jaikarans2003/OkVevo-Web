/**
 * Weekly Cloud Scheduler → POST with Authorization: Bearer CRON_SECRET.
 * Alerts if live USD/INR has drifted > ~7% outside the ₹95–100 book band.
 * Never auto-changes a Razorpay plan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { env } from '@/config/env';
import { evaluateFxDrift, fetchUsdInrRate } from '@/lib/billing/fxDrift';
import { db } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

async function notifyOps(text: string): Promise<void> {
    const url = (process.env.OPS_ALERT_WEBHOOK_URL ?? '').trim();
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(4000),
        });
    } catch (err) {
        console.error('fx-drift: ops webhook failed', err);
    }
}

export async function POST(request: NextRequest) {
    const secret = env.cronSecret;
    const authHeader = request.headers.get('authorization') || '';
    const token = /^Bearer\s+(\S+)/i.exec(authHeader.trim())?.[1];
    if (!secret || !token || token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let quote: { rate: number; source: string };
    try {
        quote = await fetchUsdInrRate();
    } catch (err) {
        const message = err instanceof Error ? err.message : 'FX rate unavailable';
        console.error('fx-drift: rate fetch failed', message);
        await db.doc('opsAlerts/fxDrift').set(
            {
                checkedAt: FieldValue.serverTimestamp(),
                error: message,
                alert: false,
            },
            { merge: true }
        );
        return NextResponse.json({ ok: false, error: message });
    }

    const evaluation = evaluateFxDrift(quote.rate);
    const payload = {
        checkedAt: FieldValue.serverTimestamp(),
        rate: quote.rate,
        source: quote.source,
        bandLow: evaluation.bandLow,
        bandHigh: evaluation.bandHigh,
        driftRatio: evaluation.driftRatio,
        threshold: evaluation.threshold,
        alert: evaluation.alert,
        error: FieldValue.delete(),
        note: 'INR price book assumes ~₹95–100 per USD. Review display prices manually — never auto-change live Plans.',
        adminEmails: (process.env.ADMIN_EMAILS ?? '').trim() || null,
    };

    await db.doc('opsAlerts/fxDrift').set(payload, { merge: true });

    if (evaluation.alert) {
        const pct = (evaluation.driftRatio * 100).toFixed(1);
        const text =
            `OkVevo FX drift ${pct}%: USD/INR=${quote.rate} (source ${quote.source}) ` +
            `outside ₹${evaluation.bandLow}–${evaluation.bandHigh}/$ band by >${evaluation.threshold * 100}%. ` +
            `Review INR price book manually. Do not auto-change Razorpay plans.`;
        console.error(text);
        await notifyOps(text);
    }

    return NextResponse.json({
        ok: true,
        rate: quote.rate,
        source: quote.source,
        driftRatio: evaluation.driftRatio,
        alert: evaluation.alert,
    });
}
