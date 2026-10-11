/**
 * Backup dispatcher. Cloud Scheduler every minute → POST Authorization: Bearer CRON_SECRET.
 * Settle, fail, and cancel dispatch in the same request. This run only
 * starts holds that those events missed. It never submits a run_id twice.
 */

import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { dispatchQueuedUsers } from '@/lib/fal/handleQueue';

export const runtime = 'nodejs';

function authorized(request: NextRequest): boolean {
  const secret = env.cronSecret;
  const token = /^Bearer\s+(\S+)/i.exec(request.headers.get('authorization') || '')?.[1];
  return Boolean(secret && token && token === secret);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const users = await dispatchQueuedUsers();
  return NextResponse.json({ ok: true, users });
}
