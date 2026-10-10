/**
 * One labelled Telegram/webhook message. Bearer CRON_SECRET.
 * Run once locally only after Karan confirms. Do not call this from the daily cron.
 */

import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { sendOpsAlert } from '@/lib/ops/alert';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = env.cronSecret;
  const token = /^Bearer\s+(\S+)/i.exec(request.headers.get('authorization') || '')?.[1];
  if (!secret || !token || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await sendOpsAlert(
    {
      severity: 'INFO',
      condition: 'alerts-test',
      id: 'manual',
      text: 'OkVevo alerts-test: labelled message. No secret is included.',
    },
    { nowMs: Date.now(), env: process.env, store: new Map() }
  );
  return NextResponse.json({ ok: true, result });
}
