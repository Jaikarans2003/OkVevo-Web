import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'
import {
  CHILD_ORG_HEALTHS,
  CHILD_ORG_SORTS,
  cursorValueValid,
  decodeSortCursor,
  listChildOrganisations,
  parseLimit,
  type ChildOrgHealth,
  type ChildOrgSort,
} from '@/lib/orgs/orgLists'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/**
 * GET /api/orgs/:publicId/organisations — super-org child list.
 * Owner of the super-org, or platform admin (read-only). One SQL query per page.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  const url = new URL(req.url)

  const sortRaw = url.searchParams.get('sort') ?? 'name'
  if (!(CHILD_ORG_SORTS as readonly string[]).includes(sortRaw)) {
    return NextResponse.json({ error: 'invalid_sort', code: 'invalid_sort' }, { status: 400 })
  }
  const healthRaw = url.searchParams.get('health')
  if (healthRaw && !(CHILD_ORG_HEALTHS as readonly string[]).includes(healthRaw)) {
    return NextResponse.json({ error: 'invalid_health', code: 'invalid_health' }, { status: 400 })
  }
  const limit = parseLimit(url.searchParams.get('limit'))
  if (limit == null) {
    return NextResponse.json({ error: 'invalid_limit', code: 'invalid_limit' }, { status: 400 })
  }
  const cursorRaw = url.searchParams.get('cursor')
  const cursor = decodeSortCursor(cursorRaw)
  if (cursorRaw && (!cursor || !cursorValueValid(sortRaw, cursor))) {
    return NextResponse.json({ error: 'invalid_cursor', code: 'invalid_cursor' }, { status: 400 })
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
  if (authz.org.kind !== 'super_org') {
    return NextResponse.json({ error: 'not_super_org', code: 'not_super_org' }, { status: 400 })
  }
  if (authz.role !== 'owner' && authz.role !== 'platform_admin') {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }

  const q = (url.searchParams.get('q') ?? '').trim() || null
  const page = await listChildOrganisations(sql, {
    superOrgId: authz.org.id,
    q,
    sort: sortRaw as ChildOrgSort,
    cursor,
    limit,
    health: (healthRaw as ChildOrgHealth | null) ?? null,
  })
  return NextResponse.json(page)
}
