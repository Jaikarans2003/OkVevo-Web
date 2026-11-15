import { NextRequest, NextResponse } from 'next/server'

import { billingSummaryFromAccount } from '@/lib/api/billingSummary'
import { ensureMe } from '@/lib/api/me'
import { getBillingByUserId } from '@/lib/db/wallet'
import { sql } from '@/lib/db/client'
import { uidFromIdToken } from '@/lib/gateway/auth'

export const runtime = 'nodejs'

/** GET /api/billing/summary — percentages only; no raw balances. */
export async function GET(req: NextRequest) {
  const user = await uidFromIdToken(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await ensureMe(user.uid, { email: user.email || null })
  const billing = await getBillingByUserId(sql, user.uid)
  return NextResponse.json(billingSummaryFromAccount(billing))
}
