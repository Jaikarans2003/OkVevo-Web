import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { jobsCsv, listOrgJobs, parseJobParams } from '@/lib/analytics/jobs'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** GET /api/orgs/:publicId/jobs — members see only their own rows. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  const url = new URL(req.url)
  const parsed = parseJobParams(url.searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.code, code: parsed.code }, { status: 400 })
  }

  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: 'read',
    email: user.email,
    emailVerified: user.emailVerified,
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
  const userId = canSeeAll ? parsed.params.member : user.uid
  const page = await listOrgJobs(sql, {
    orgId: authz.org.id,
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
