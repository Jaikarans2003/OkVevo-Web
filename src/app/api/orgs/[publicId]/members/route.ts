import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { getBillingByOrgId } from '@/lib/db/wallet'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'
import { usagePeriodWindow } from '@/lib/orgs/periodWindow'
import {
  cursorValueValid,
  decodeSortCursor,
  listOrgMembers,
  ORG_MEMBER_SORTS,
  parseLimit,
  type OrgMemberSort,
} from '@/lib/orgs/orgLists'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** Owner / platform / inherited_read may list members; plain members may not. */
function canSeeMembersList(role: string): boolean {
  return (
    role === 'owner' ||
    role === 'inherited_read' ||
    role === 'platform_admin'
  )
}

/** GET /api/orgs/:publicId/members — member list with per-member usage. One SQL query per page. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  const url = new URL(req.url)

  const sortRaw = url.searchParams.get('sort') ?? 'name'
  if (!(ORG_MEMBER_SORTS as readonly string[]).includes(sortRaw)) {
    return NextResponse.json({ error: 'invalid_sort', code: 'invalid_sort' }, { status: 400 })
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
  if (!canSeeMembersList(authz.role)) {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }

  const billing = await getBillingByOrgId(sql, authz.org.id)
  const window = usagePeriodWindow({
    accessMode: billing?.accessMode ?? 'subscription',
    billingCycle: billing?.billingCycle ?? null,
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
  })
  const q = (url.searchParams.get('q') ?? '').trim() || null
  const page = await listOrgMembers(sql, {
    orgId: authz.org.id,
    billingAccountId: billing?.id ?? null,
    window,
    q,
    sort: sortRaw as OrgMemberSort,
    cursor,
    limit,
  })
  return NextResponse.json(page)
}
