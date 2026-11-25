import { NextRequest, NextResponse } from 'next/server'

import { jobsCsv, listOrgJobs, parseJobParams } from '@/lib/analytics/jobs'
import { ensureMe } from '@/lib/api/me'
import { sql } from '@/lib/db/client'
import { uidFromIdToken } from '@/lib/gateway/auth'
import { authorizeOrg } from '@/lib/orgs/authorize'
import {
  orgPublicIdFromRequest,
  resolvePayingWallet,
} from '@/lib/orgs/orgContext'

export const runtime = 'nodejs'

/** GET /api/billing/jobs — jobs on the paying wallet. X-OkVevo-Org selects an org wallet. */
export async function GET(req: NextRequest) {
  const user = await uidFromIdToken(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await ensureMe(user.uid, { email: user.email || null })

  const url = new URL(req.url)
  const parsed = parseJobParams(url.searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.code, code: parsed.code }, { status: 400 })
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

  const page = await listOrgJobs(sql, {
    billingAccountId: paying.billingAccountId,
    userId,
    from: parsed.params.from,
    to: parsed.params.to,
    model: parsed.params.model,
    jobType: parsed.params.jobType,
    status: parsed.params.status,
    cursor: parsed.params.cursor,
    limit: parsed.params.limit,
  })

  if (parsed.params.csv) {
    return new NextResponse(jobsCsv(page.items), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="jobs.csv"',
      },
    })
  }

  return NextResponse.json(page)
}
