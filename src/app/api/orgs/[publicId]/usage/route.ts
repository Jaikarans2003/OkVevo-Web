import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

type GroupBy = 'user' | 'end_customer' | 'org' | 'day' | 'department'

/** GET /api/orgs/:publicId/usage?from&to&group_by= */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  const url = new URL(req.url)
  const fromRaw = url.searchParams.get('from')
  const toRaw = url.searchParams.get('to')
  const groupBy = (url.searchParams.get('group_by') || 'day') as GroupBy
  if (!['user', 'end_customer', 'org', 'day', 'department'].includes(groupBy)) {
    return NextResponse.json({ error: 'invalid_group_by', code: 'invalid_group_by' }, { status: 400 })
  }

  const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 864e5)
  const to = toRaw ? new Date(toRaw) : new Date()
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'invalid_range', code: 'invalid_range' }, { status: 400 })
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

  const isAdmin =
    authz.role === 'owner' ||
    authz.role === 'admin' ||
    authz.role === 'inherited_admin' ||
    authz.role === 'platform_admin'

  // Members only see their own rows; admins see the org (and child orgs for super-org + group_by=org).
  const memberFilter = isAdmin ? sql`` : sql`and user_id = ${user.uid}`

  if (groupBy === 'org' && !(authz.org.kind === 'super_org' && isAdmin)) {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }

  let rows
  if (groupBy === 'day') {
    rows = await sql`
      select day, sum(requests)::int as requests, sum(credits)::int as credits
      from usage_daily
      where day >= ${from} and day < ${to}
        and (org_id = ${authz.org.id} or super_org_id = ${authz.org.id})
        ${memberFilter}
      group by day
      order by day asc
    `
  } else if (groupBy === 'user') {
    rows = await sql`
      select user_id, sum(requests)::int as requests, sum(credits)::int as credits
      from usage_daily
      where day >= ${from} and day < ${to}
        and (org_id = ${authz.org.id} or super_org_id = ${authz.org.id})
        ${memberFilter}
      group by user_id
      order by credits desc nulls last
    `
  } else if (groupBy === 'end_customer') {
    rows = await sql`
      select end_customer_ref, sum(requests)::int as requests, sum(credits)::int as credits
      from usage_daily
      where day >= ${from} and day < ${to}
        and (org_id = ${authz.org.id} or super_org_id = ${authz.org.id})
        ${memberFilter}
      group by end_customer_ref
      order by credits desc nulls last
    `
  } else if (groupBy === 'org') {
    rows = await sql`
      select org_id, sum(requests)::int as requests, sum(credits)::int as credits
      from usage_daily
      where day >= ${from} and day < ${to}
        and (org_id = ${authz.org.id} or super_org_id = ${authz.org.id} or org_id in (
          select id from organizations where parent_id = ${authz.org.id}
        ))
      group by org_id
      order by credits desc nulls last
    `
  } else {
    // department — join current membership label (moving people does not rewrite history).
    if (!isAdmin) {
      return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
    }
    rows = await sql`
      select m.department_id, d.name as department_name,
             sum(u.requests)::int as requests, sum(u.credits)::int as credits
      from usage_daily u
      left join memberships m
        on m.org_id = u.org_id and m.user_id = u.user_id and m.status = 'active'
      left join departments d on d.id = m.department_id
      where u.day >= ${from} and u.day < ${to}
        and u.org_id = ${authz.org.id}
      group by m.department_id, d.name
      order by credits desc nulls last
    `
  }

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    groupBy,
    rows,
  })
}
