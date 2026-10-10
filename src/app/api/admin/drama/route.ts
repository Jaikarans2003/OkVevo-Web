/**
 * GET — admin dashboard data. The admin custom claim is verified on the
 * SERVER for every call; non-admins get 404 (the area does not exist for
 * them). Reads pre-aggregated adminRollups + opsAlerts + opsConfig, plus
 * clonedVoices counts (not a gatewayJobs scan).
 */

import { NextRequest, NextResponse } from 'next/server';

import { db, verifyAdminToken } from '@/lib/firebase-admin';
import { gatewayIdToken } from '@/lib/gateway/auth';
import { dailySpendLimitFromEnv } from '@/lib/fal/dramaSwitches';
import { utcDay } from '@/lib/ops/alert';
import { countVoiceStats, listAllClonedVoices } from '@/lib/fal/voiceOwnership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(request: NextRequest) {
  const token = gatewayIdToken(request);
  if (!token || !(await verifyAdminToken(token))) return notFound();

  const nowMs = Date.now();
  const today = utcDay(nowMs);
  const yesterday = utcDay(nowMs - 24 * 60 * 60 * 1000);

  const [todaySnap, yesterdaySnap, killSnap, heartbeatSnap, alertsSnap, spendSnap, voices] =
    await Promise.all([
      db.doc(`adminRollups/${today}`).get(),
      db.doc(`adminRollups/${yesterday}`).get(),
      db.doc('opsConfig/drama').get(),
      db.doc('opsAlerts/falDrift-heartbeat').get(),
      db
        .collection('opsAlerts')
        .where('severity', '==', 'HIGH')
        .where('resolved', '==', false)
        .limit(50)
        .get(),
      db.doc(`spendDaily/${today}`).get(),
      listAllClonedVoices(),
    ]);

  const heartbeatAtMs = heartbeatSnap.data()?.checkedAt?.toMillis?.() ?? null;
  return NextResponse.json({
    rollup: todaySnap.exists ? todaySnap.data() : null,
    previousRollup: yesterdaySnap.exists ? yesterdaySnap.data() : null,
    killSwitch: { disabled: killSnap.data()?.disabled === true },
    heartbeat: { checkedAtMs: heartbeatAtMs, stale: heartbeatAtMs == null || nowMs - heartbeatAtMs > 26 * 60 * 60 * 1000 },
    highAlerts: alertsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    spendToday: spendSnap.data() ?? { falUsd: 0, creditsCharged: 0, jobs: 0 },
    breakerLimitUsd: dailySpendLimitFromEnv(process.env),
    voices: countVoiceStats(voices, nowMs),
    serverTimeMs: nowMs,
  });
}
