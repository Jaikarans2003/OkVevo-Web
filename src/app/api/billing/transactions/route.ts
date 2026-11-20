import { NextRequest, NextResponse } from 'next/server'

import { listBillingTransactions } from '@/lib/api/billingTransactions'
import { ensureMe } from '@/lib/api/me'
import { sql } from '@/lib/db/client'
import { uidFromIdToken } from '@/lib/gateway/auth'
import { authorizeOrg } from '@/lib/orgs/authorize'
import {
  orgPublicIdFromRequest,
  resolvePayingWallet,
} from '@/lib/orgs/orgContext'

export const runtime = 'nodejs'

/** GET /api/billing/transactions?cursor= — ledger page for the paying wallet. */
export async function GET(req: NextRequest) {
  const user = await uidFromIdToken(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await ensureMe(user.uid, { email: user.email || null })

  const orgPublicId = orgPublicIdFromRequest(req)
  const paying = await resolvePayingWallet(sql, {
    userId: user.uid,
    orgPublicId,
    email: user.email,
  })
  if (!paying.ok) {
    return NextResponse.json(
      { error: paying.code, code: paying.code },
      { status: paying.status }
    )
  }

  if (paying.orgId) {
    const orgRows = await sql`
      select public_id from organizations where id = ${paying.orgId}
    `
    const publicId = orgRows[0]?.public_id as string | undefined
    if (!publicId) {
      return NextResponse.json(
        { error: 'org_not_found', code: 'org_not_found' },
        { status: 404 }
      )
    }
    const authz = await authorizeOrg(sql, {
      userId: user.uid,
      orgPublicId: publicId,
      need: 'admin',
      email: user.email,
    })
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.code, code: authz.code },
        { status: authz.code === 'org_not_found' ? 404 : 403 }
      )
    }
  }

  const cursor = req.nextUrl.searchParams.get('cursor')
  try {
    const page = await listBillingTransactions(paying.billingAccountId, cursor)
    return NextResponse.json(page)
  } catch (err) {
    if (err instanceof Error && err.message === 'invalid_cursor') {
      return NextResponse.json({ error: 'invalid_cursor' }, { status: 400 })
    }
    throw err
  }
}
