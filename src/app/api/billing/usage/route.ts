import { NextRequest, NextResponse } from 'next/server'

import { parseUsageParams, queryUsage, usageCsv } from '@/lib/analytics/usage'
import { ensureMe } from '@/lib/api/me'
import { sql } from '@/lib/db/client'
import { uidFromIdToken } from '@/lib/gateway/auth'
import { authorizeOrg } from '@/lib/orgs/authorize'
import {
  orgPublicIdFromRequest,
  resolvePayingWallet,
} from '@/lib/orgs/orgContext'

export const runtime = 'nodejs'

/** GET /api/billing/usage — usage for the paying wallet. X-OkVevo-Org selects an org wallet. */
export async function GET(req: NextRequest) {
  const user = await uidFromIdToken(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await ensureMe(user.uid, { email: user.email || null })

  const url = new URL(req.url)
  const parsed = parseUsageParams(url.searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.code, code: parsed.code }, { status: 400 })
  }
  // A wallet has no child-org rollup; group_by=org is org-scope only.
  if (parsed.params.groupBy === 'org') {
    return NextResponse.json({ error: 'invalid_group_by', code: 'invalid_group_by' }, { status: 400 })
  }

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

  let userId: string | null = null
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
      need: 'read',
      email: user.email,
    })
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.code, code: authz.code },
        { status: authz.code === 'org_not_found' ? 404 : 403 }
      )
    }
    const canSeeAll =
      authz.role === 'owner' ||
      authz.role === 'inherited_read' ||
      authz.role === 'platform_admin'
    // Member role: always own rows, any member param is ignored.
    userId = canSeeAll ? parsed.params.member : user.uid
  }

  const out = await queryUsage(
    sql,
    parsed.params,
    { kind: 'wallet', billingAccountId: paying.billingAccountId },
    userId
  )
  if (!out.ok) {
    return NextResponse.json({ error: out.code, code: out.code }, { status: 400 })
  }

  if (parsed.params.csv) {
    return new NextResponse(usageCsv(out.result), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="usage.csv"',
      },
    })
  }

  return NextResponse.json(out.result)
}
