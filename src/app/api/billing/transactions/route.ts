import { NextRequest, NextResponse } from 'next/server'

import { listBillingTransactions } from '@/lib/api/billingTransactions'
import { ensureMe } from '@/lib/api/me'
import { uidFromIdToken } from '@/lib/gateway/auth'

export const runtime = 'nodejs'

/** GET /api/billing/transactions?cursor= — ledger page for the caller's personal wallet. */
export async function GET(req: NextRequest) {
  const user = await uidFromIdToken(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await ensureMe(user.uid, { email: user.email || null })
  const cursor = req.nextUrl.searchParams.get('cursor')
  try {
    const page = await listBillingTransactions(user.uid, cursor)
    return NextResponse.json(page)
  } catch (err) {
    if (err instanceof Error && err.message === 'invalid_cursor') {
      return NextResponse.json({ error: 'invalid_cursor' }, { status: 400 })
    }
    throw err
  }
}
