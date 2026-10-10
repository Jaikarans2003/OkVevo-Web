/**
 * Daily Cloud Scheduler → POST Authorization: Bearer CRON_SECRET.
 * Price drift (generation credential) and abandoned submitted holds.
 * Deterministic billing mode: the existing Fal key gets 403 on usage and
 * billing-events, so realized margin is estimated from the rate card —
 * see docs/adr/ADR-001-drama-full-parity.md. The estimate API
 * (historical_api_price) is the drift tripwire.
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
import { auth, db } from '@/lib/firebase-admin';
import { buildRollup, type RollupJobRow } from '@/lib/admin/rollup';
import { estimateHistoricalCost, falQueueGet, getEndpointPricing } from '@/lib/fal/client';
import { dailySpendLimitFromEnv } from '@/lib/fal/dramaSwitches';
import { settleFalJob } from '@/lib/fal/handleQueue';
import { holdIsDue, reservedHoldAbandoned, sweepAction } from '@/lib/fal/holdSweep';
import { RATE_CARD_IDS, priceDrift, rateCardEntry } from '@/lib/fal/rateCard';
import { releaseCredits } from '@/lib/gateway/debit';
import { sendOpsAlert, utcDay, type AlertSeverity } from '@/lib/ops/alert';
import { firestoreAlertStore } from '@/lib/ops/firestoreAlertStore';

export const runtime = 'nodejs';

async function alertOnce(
  severity: AlertSeverity,
  condition: string,
  id: string,
  text: string,
  nowMs: number
) {
  await sendOpsAlert(
    { severity, condition, id, text },
    { nowMs, store: firestoreAlertStore(db) }
  );
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
  let submittedOld = 0;
  const jobs = await db.collection('gatewayJobs').where('status', '==', 'submitted').get();
  for (const doc of jobs.docs) {
    const data = doc.data();
    const created = data.createdAt?.toMillis?.() ?? nowMs;
    if (!holdIsDue(created, nowMs)) continue;
    submittedOld += 1;
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
  // and NEVER resubmit: only a human can tell Fal did not run the job (Fal
  // dashboard usage page for its window), then scripts/drama-release-hold.ts
  // releases through the same compare-and-set. HIGH alerts surface on the
  // admin dashboard banner until resolved.
  let reservedOld = 0;
  const reserved = await db.collection('gatewayJobs').where('status', '==', 'reserved').get();
  for (const doc of reserved.docs) {
    const data = doc.data();
    const created = data.createdAt?.toMillis?.() ?? nowMs;
    if (!reservedHoldAbandoned(created, nowMs, data.falRequestId)) continue;
    reservedOld += 1;
    sweep.alerted += 1;
    await alertOnce(
      'HIGH',
      'hold-reserved-no-fal-id',
      doc.id,
      `reserved hold ${doc.id} older than 30m has no Fal request id; not released, not resubmitted. ` +
        'Check the Fal dashboard usage page for its window, then scripts/drama-release-hold.ts',
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

  // Pre-aggregated admin dashboard rollup. The dashboard reads this, never
  // raw scans. Top users get emails attached here (server-side only).
  const day = utcDay(nowMs);
  const dayStartMs = Date.parse(`${day}T00:00:00.000Z`);
  const createdToday = await db
    .collection('gatewayJobs')
    .where('createdAt', '>=', new Date(dayStartMs))
    .get();
  const jobsToday: RollupJobRow[] = createdToday.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: String(d.uid ?? ''),
      endpoint: String(d.endpoint ?? ''),
      status: String(d.status ?? ''),
      createdAtMs: d.createdAt?.toMillis?.() ?? dayStartMs,
      settledAtMs: d.settledAt?.toMillis?.(),
      settledCredits: typeof d.settledCredits === 'number' ? d.settledCredits : undefined,
      settledFalUsd: typeof d.settledFalUsd === 'number' ? d.settledFalUsd : undefined,
    };
  });
  const unknownHolds = await db.collection('gatewayJobs').where('status', '==', 'unknown').get();

  // Historical drift tripwire (deterministic mode, ADR-001): Fal's estimate
  // API (historical_api_price) vs our rate-card average per call over the
  // same settled jobs. Thresholds: INFO above 25% deviation, HIGH above 100%
  // — below 25% is inside the formula's conservative-rounding noise (H3 step
  // table, ceil-per-second audio); 2x means the card or Fal's price moved.
  const settledCosts = new Map<string, number[]>();
  for (const j of jobsToday) {
    if (typeof j.settledFalUsd === 'number' && j.settledFalUsd > 0) {
      const arr = settledCosts.get(j.endpoint) ?? [];
      arr.push(j.settledFalUsd);
      settledCosts.set(j.endpoint, arr);
    }
  }
  const historical: { endpoint: string; level: string; note: string }[] = [];
  for (const [endpoint, costs] of settledCosts) {
    if (costs.length < 5) continue;
    const ours = costs.reduce((a, b) => a + b, 0) / costs.length;
    const falTotal = await estimateHistoricalCost(endpoint, costs.length);
    if (falTotal == null || falTotal <= 0) continue;
    const falAvg = falTotal / costs.length;
    const deviation = Math.abs(falAvg - ours) / Math.max(falAvg, 0.0001);
    const level = deviation > 1 ? 'HIGH' : deviation > 0.25 ? 'INFO' : 'ok';
    const note =
      `fal historical avg $${falAvg.toFixed(4)} vs rate-card avg $${ours.toFixed(4)} ` +
      `over ${costs.length} calls (${(deviation * 100).toFixed(0)}%)`;
    historical.push({ endpoint, level, note });
    if (level !== 'ok') {
      await alertOnce(
        level === 'HIGH' ? 'HIGH' : 'INFO',
        'price-drift-historical',
        endpoint,
        `${level} historical cost deviation ${endpoint}: ${note}`,
        nowMs
      );
    }
  }

  const spendSnap = await db.doc(`spendDaily/${day}`).get();
  const spendData = spendSnap.data() ?? {};
  const rollup = buildRollup({
    day,
    jobsToday,
    holds: { unknown: unknownHolds.size, reservedOld, submittedOld },
    spendDaily: {
      falUsd: Number(spendData.falUsd ?? 0),
      creditsCharged: Number(spendData.creditsCharged ?? 0),
      jobs: Number(spendData.jobs ?? 0),
      overReserveEvents: Number(spendData.overReserveEvents ?? 0),
    },
    breakerLimitUsd: dailySpendLimitFromEnv(process.env),
  });
  const topUsers = await Promise.all(
    rollup.topUsers.map(async (row) => {
      let email = '';
      try {
        email = (await auth.getUser(row.uid)).email ?? '';
      } catch {
        /* user may be deleted; uid stays */
      }
      return { uid: row.uid, email, creditsCharged: row.creditsCharged };
    })
  );
  await db.doc(`adminRollups/${day}`).set(
    {
      ...rollup,
      topUsers,
      priceHealth: [
        ...lines.map((l) => ({ endpoint: l.endpoint, level: l.level, note: l.note })),
        ...historical,
      ],
      writtenAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, drift: lines, sweep });
}
