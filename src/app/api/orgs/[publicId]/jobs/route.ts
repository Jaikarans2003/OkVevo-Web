import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { csvCell, csvLine } from '@/lib/analytics/csv'
import { listOrgJobs } from '@/lib/analytics/jobs'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** GET /api/orgs/:publicId/jobs — members see only their own rows. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
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

  const url = new URL(req.url)
  const ownOnly = authz.role === 'member'
  const page = await listOrgJobs(sql, {
    orgId: authz.org.id,
    userId: ownOnly ? user.uid : null,
    cursor: url.searchParams.get('cursor'),
    limit: Number(url.searchParams.get('limit') || 50),
  })

  if (url.searchParams.get('format') === 'csv') {
    const lines = [
      csvLine(['Time', 'Member', 'Model', 'Job type', 'Status', 'Credits', 'Release reason'].map((c) => csvCell(c))),
      ...page.items.map((row) =>
        csvLine([
          csvCell(row.createdAt),
          csvCell(row.memberUserId),
          csvCell(row.modelLabel),
          csvCell(row.jobType),
          csvCell(row.status),
          csvCell(row.credits, 'number'),
          csvCell(row.releaseReason),
        ])
      ),
    ]
    return new NextResponse(lines.join(''), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="jobs.csv"',
      },
    })
  }

  return NextResponse.json(page)
}
