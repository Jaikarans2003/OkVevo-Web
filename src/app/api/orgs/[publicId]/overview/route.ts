import { NextRequest, NextResponse } from 'next/server'

import { loadOrgOverview, type OverviewRole } from '@/lib/analytics/overview'
import { sql } from '@/lib/db/client'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

function canReadOverview(role: string): role is OverviewRole {
  return role === 'owner' || role === 'inherited_read' || role === 'platform_admin'
}

/** GET /api/orgs/:publicId/overview — dashboard KPIs. Members get 403. */
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
  if (!canReadOverview(authz.role)) {
    return NextResponse.json(
      { error: 'org_access_denied', code: 'org_access_denied' },
      { status: 403 }
    )
  }

  const overview = await loadOrgOverview(sql, { org: authz.org, role: authz.role })
  return NextResponse.json(overview)
}
