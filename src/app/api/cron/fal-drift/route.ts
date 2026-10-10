/**
 * Daily Cloud Scheduler → POST Authorization: Bearer CRON_SECRET.
 * Price drift (generation credential) and abandoned submitted holds.
 * The margin report is scripts/fal-margin-report.ts and is not called here.
 * It needs FAL_BILLING_KEY, which does not belong on this server.
 *
 * Card-update runbook:
 * 1. Edit src/lib/fal/rateCard.ts.
 * 2. npm run check:all.
 * 3. npx tsx scripts/fal-price-drift.ts — confirm the alert cleared.
 * 4. Deploy via staging → production.
 * 5. Record the change in hermes-agent/docs/fork-deltas/portal-gateway-billing.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { env } from '@/config/env';
import { db } from '@/lib/firebase-admin';
import { falQueueGet, getEndpointPricing } from '@/lib/fal/client';
import { settleFalJob } from '@/lib/fal/handleQueue';
import { holdIsDue, reservedHoldAbandoned, sweepAction } from '@/lib/fal/holdSweep';
import { RATE_CARD_IDS, priceDrift, rateCardEntry } from '@/lib/fal/rateCard';
import { releaseCredits } from '@/lib/gateway/debit';
import { alertDocId, sendOpsAlert, utcDay } from '@/lib/ops/alert';

export const runtime = 'nodejs';

async function alertOnce(
  severity: 'HIGH' | 'INFO',
  condition: string,
  id: string,
  text: string,
  nowMs: number
) {
  const docId = alertDocId(condition, id, utcDay(nowMs));
  const ref = db.doc(`opsAlerts/${docId}`);
  if (severity === 'HIGH' && (await ref.get()).exists) return;
  await sendOpsAlert(
    { severity, condition, id, text },
    { nowMs, env: process.env, store: new Map() }
  );
  if (severity === 'HIGH') {
    await ref.set({ day: utcDay(nowMs), text, at: FieldValue.serverTimestamp() });
  }
}

function authorized(request: NextRequest): boolean {
  const secret = env.cronSecret;
  const token = /^Bearer\s+(\S+)/i.exec(request.headers.get('authorization') || '')?.[1];
  return Boolean(secret && token && token === secret);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const nowMs = Date.now();
  const liveByEndpoint: Record<string, number | null> = {};
  for (const id of RATE_CARD_IDS) {
    if (rateCardEntry(id)?.source === 'card') {
      liveByEndpoint[id] = null;
      continue;
    }
    const row = await getEndpointPricing(id);
    liveByEndpoint[id] = row?.unitPrice ?? null;
  }
  const lines = priceDrift({ nowMs, liveByEndpoint });
  for (const line of lines) {
    if (line.level === 'ok') continue;
    await alertOnce(
      line.level === 'HIGH' ? 'HIGH' : 'INFO',
      'price-drift',
      line.endpoint,
      `${line.level} fal price drift ${line.endpoint}: ${line.note}`,
      nowMs
    );
  }

  const sweep = { settled: 0, released: 0, left: 0, alerted: 0 };
  const jobs = await db.collection('gatewayJobs').where('status', '==', 'submitted').get();
  for (const doc of jobs.docs) {
    const data = doc.data();
    const created = data.createdAt?.toMillis?.() ?? nowMs;
    if (!holdIsDue(created, nowMs)) continue;
    const url = typeof data.falStatusUrl === 'string' ? data.falStatusUrl : '';
    if (!url) {
      sweep.alerted += 1;
      await alertOnce(
        'HIGH',
        'hold-unknown',
        doc.id,
        `submitted hold ${doc.id} has no Fal status url; not resubmitted`,
        nowMs
      );
      continue;
    }
    let falStatus = 'unknown';
    try {
      const got = await falQueueGet(url);
      const rec = got.json && typeof got.json === 'object' ? (got.json as { status?: unknown }) : {};
      falStatus = String(rec.status ?? 'unknown');
    } catch {
      falStatus = 'unknown';
    }
    const action = sweepAction(falStatus);
    if (action === 'leave') {
      sweep.left += 1;
      continue;
    }
    if (action === 'settle') {
      await settleFalJob({ requestId: doc.id, ok: true });
      sweep.settled += 1;
      continue;
    }
    if (action === 'release') {
      await releaseCredits(doc.id);
      sweep.released += 1;
      continue;
    }
    sweep.alerted += 1;
    await alertOnce(
      'HIGH',
      'hold-unknown',
      doc.id,
      `submitted hold ${doc.id} Fal status unknown; not resubmitted`,
      nowMs
    );
  }

  // A `reserved` hold (never submitted to Fal, no request id) past the
  // abandoned threshold gets ONE HIGH alert per UTC day. NEVER auto-release
  // and NEVER resubmit: only a human can tell Fal did not run the job, via
  // billing-events, then scripts/drama-release-hold.ts releases through the
  // same compare-and-set. See docs/fal-alerts-telegram.md.
  const reserved = await db.collection('gatewayJobs').where('status', '==', 'reserved').get();
  for (const doc of reserved.docs) {
    const data = doc.data();
    const created = data.createdAt?.toMillis?.() ?? nowMs;
    if (!reservedHoldAbandoned(created, nowMs, data.falRequestId)) continue;
    sweep.alerted += 1;
    await alertOnce(
      'HIGH',
      'hold-reserved-no-fal-id',
      doc.id,
      `reserved hold ${doc.id} older than 30m has no Fal request id; not released, not resubmitted. ` +
        'Check Fal billing-events for its window, then scripts/drama-release-hold.ts',
      nowMs
    );
  }

  await db.doc('opsAlerts/falDrift-heartbeat').set(
    {
      checkedAt: FieldValue.serverTimestamp(),
      drift: lines.length,
      sweep,
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, drift: lines, sweep });
}
