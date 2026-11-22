import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg, type OrgRole } from '@/lib/orgs/authorize'
import { leaveOrgAsMember, removeMember, setMemberRole } from '@/lib/orgs/members'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string; uid: string }> }

/** PATCH /api/orgs/:publicId/members/:uid `{role}` — owner only; roles owner|member. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId, uid } = await ctx.params
  let body: { role?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const role = body.role as OrgRole | undefined
  if (role == null || !['owner', 'member'].includes(role)) {
    return NextResponse.json({ error: 'invalid_role', code: 'invalid_role' }, { status: 400 })
  }

  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: 'owner',
    email: user.email,
    emailVerified: user.emailVerified,
  })
  if (!authz.ok) {
    return NextResponse.json(
      { error: authz.code, code: authz.code },
      { status: authz.code === 'org_not_found' ? 404 : 403 }
    )
  }

  const result = await withTx((tx) =>
    setMemberRole(tx, {
      orgId: authz.org.id,
      userId: uid,
      role,
      actorUserId: user.uid,
    })
  )
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }
  return NextResponse.json({ success: true, role })
}

/**
 * DELETE /api/orgs/:publicId/members/:uid — soft-remove.
 * Owner may remove anyone (last_owner guarded). Caller may self-leave.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId, uid } = await ctx.params
  const selfLeave = uid === user.uid

  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: selfLeave ? 'read' : 'owner',
    email: user.email,
    emailVerified: user.emailVerified,
  })
  if (!authz.ok) {
    return NextResponse.json(
      { error: authz.code, code: authz.code },
      { status: authz.code === 'org_not_found' ? 404 : 403 }
    )
  }
  if (authz.role === 'inherited_read' && !selfLeave) {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }
  if (selfLeave && authz.role === 'inherited_read') {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }

  const result = await withTx((tx) =>
    selfLeave
      ? leaveOrgAsMember(tx, { orgId: authz.org.id, userId: user.uid })
      : removeMember(tx, { orgId: authz.org.id, userId: uid, actorUserId: user.uid })
  )
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }
  return NextResponse.json({ success: true })
}
