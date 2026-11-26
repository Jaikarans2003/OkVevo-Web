import { NextRequest, NextResponse } from 'next/server'

import { loadCreditsHealth } from '@/lib/analytics/billingCredits'
import { ensureMe } from '@/lib/api/me'
import { sql } from '@/lib/db/client'
import { uidFromIdToken } from '@/lib/gateway/auth'
import { authorizeOrg } from '@/lib/orgs/authorize'
import {
  orgPublicIdFromRequest,
  resolvePayingWallet,
} from '@/lib/orgs/orgContext'

export const runtime = 'nodejs'

/** GET /api/billing/credits — credits health for the paying wallet. Org wallets: owner only. */
export async function GET(req: NextRequest) {
  const user = await uidFromIdToken(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await ensureMe(user.uid, { email: user.email || null })

  const paying = await resolvePayingWallet(sql, {
    userId: user.uid,
    orgPublicId: orgPublicIdFromRequest(req),
    email: user.email,
  })
  if (!paying.ok) {
    return NextResponse.json(
      { error: paying.code, code: paying.code },
      { status: paying.status }
    )
  }

  if (paying.orgId) {
    // Exact credits = wallet owners only.
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
      need: 'read',
      email: user.email,
    })
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.code, code: authz.code },
        { status: authz.code === 'org_not_found' ? 404 : 403 }
      )
    }
    if (authz.role !== 'owner') {
      return NextResponse.json(
        { error: 'org_access_denied', code: 'org_access_denied' },
        { status: 403 }
      )
    }
  }

  const health = await loadCreditsHealth(sql, paying.billingAccountId)
  if (!health) {
    return NextResponse.json(
      { error: 'org_not_found', code: 'org_not_found' },
      { status: 404 }
    )
  }
  return NextResponse.json(health)
}
