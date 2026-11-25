import { NextRequest, NextResponse } from 'next/server'

import { activityWording, actorLabel } from '@/lib/analytics/activityCopy'
import { decodeCursor, encodeCursor } from '@/lib/analytics/cursor'
import { sql } from '@/lib/db/client'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

function canReadActivity(role: string): boolean {
  return role === 'owner' || role === 'inherited_read' || role === 'platform_admin'
}

/** GET /api/orgs/:publicId/activity — owner / inherited_read / platform_admin. Super-org feeds include children. */
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
  if (!canReadActivity(authz.role)) {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }

  // Super-org feed includes children's events for every read-capable role
  // (owner / inherited_read / platform_admin — member is 403 above).
  const includeChildren = authz.org.kind === 'super_org'
  const cursor = decodeCursor(new URL(req.url).searchParams.get('cursor'))
  const rows = await sql`
    select a.id, a.created_at, a.actor_user_id, a.action, a.target_id, a.metadata, o.name as target_name,
           ao.name as org_name
    from audit_log a
    join organizations ao on ao.id = a.org_id
    left join organizations o on o.id::text = a.target_id
    where (
      a.org_id = ${authz.org.id}
      ${includeChildren ? sql`or a.org_id in (select id from organizations where parent_id = ${authz.org.id})` : sql``}
    )
      ${cursor ? sql`and (a.created_at, a.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : sql``}
    order by a.created_at desc, a.id desc
    limit 51
  `

  const page = rows.slice(0, 50)
  const items = page.map((row) => {
    // jsonb arrives as a string with prepare:false — parse so wording sees real fields.
    let metadata: Record<string, unknown> = {}
    if (row.metadata && typeof row.metadata === 'object') {
      metadata = row.metadata as Record<string, unknown>
    } else if (typeof row.metadata === 'string') {
      try {
        const parsed = JSON.parse(row.metadata) as unknown
        if (parsed && typeof parsed === 'object') metadata = parsed as Record<string, unknown>
      } catch {
        // keep {} — wording falls back to generic
      }
    }
    const targetName = row.target_name == null ? null : String(row.target_name)
    const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
    return {
      id: String(row.id),
      createdAt,
      actor: actorLabel(String(row.actor_user_id)),
      action: activityWording(String(row.action), metadata, targetName),
      target: targetName,
      orgName: String(row.org_name),
    }
  })
  const last = items[items.length - 1]
  return NextResponse.json({
    items,
    nextCursor: rows[50] && last ? encodeCursor(last.createdAt, last.id) : null,
  })
}
