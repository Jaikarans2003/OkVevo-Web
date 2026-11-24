import { NextRequest, NextResponse } from 'next/server'

import { listOrgCredits } from '@/lib/analytics/credits'
import { csvCell, csvLine } from '@/lib/analytics/csv'
import { sql } from '@/lib/db/client'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** GET /api/orgs/:publicId/credits — members see only their own rows. */
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
  const page = await listOrgCredits(sql, {
    orgId: authz.org.id,
    userId: authz.role === 'member' ? user.uid : null,
    cursor: url.searchParams.get('cursor'),
    limit: Number(url.searchParams.get('limit') || 50),
  })

  if (url.searchParams.get('format') === 'csv') {
    const lines = [
      csvLine(['Time', 'Member', 'Model', 'Job type', 'Bucket', 'Credits', 'Request'].map((c) => csvCell(c))),
      ...page.items.map((row) =>
        csvLine([
          csvCell(row.createdAt),
          csvCell(row.memberUserId),
          csvCell(row.modelLabel),
          csvCell(row.jobType),
          csvCell(row.bucket),
          csvCell(row.credits, 'number'),
          csvCell(row.requestId),
        ])
      ),
    ]
    return new NextResponse(lines.join(''), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="credits.csv"',
      },
    })
  }

  return NextResponse.json(page)
}
