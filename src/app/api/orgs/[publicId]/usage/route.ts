import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { parseUsageParams, queryUsage, usageCsv } from '@/lib/analytics/usage'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** GET /api/orgs/:publicId/usage — tz-bucketed credits; members see only their own rows. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  const url = new URL(req.url)
  const parsed = parseUsageParams(url.searchParams)
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

  if (parsed.params.groupBy === 'org' && !(authz.org.kind === 'super_org' && canSeeAll)) {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }

  // Member role: always own rows, any member param is ignored.
  const userId = canSeeAll ? parsed.params.member : user.uid
  const out = await queryUsage(
    sql,
    parsed.params,
    { kind: 'org', orgId: authz.org.id, includeChildren: parsed.params.groupBy === 'org' },
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
