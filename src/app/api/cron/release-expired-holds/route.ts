/**
 * Cloud Scheduler every 5 min → POST Authorization: Bearer CRON_SECRET.
 * Releases reserved chat/tavily holds past hold_expires_at.
 */
import { NextRequest, NextResponse } from 'next/server'

import { env } from '@/config/env'
import { releaseExpiredHolds } from '@/lib/gateway/releaseExpiredHolds'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secret = env.cronSecret
  const token = /^Bearer\s+(\S+)/i.exec(request.headers.get('authorization') || '')?.[1]
  if (!secret || !token || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await releaseExpiredHolds()
  return NextResponse.json({ ok: true, ...result })
}
