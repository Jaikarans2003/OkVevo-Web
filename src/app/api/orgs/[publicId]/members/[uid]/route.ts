import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg, type OrgRole } from '@/lib/orgs/authorize'
import { assignMemberDepartment } from '@/lib/orgs/departments'
import { removeMember, setMemberRole } from '@/lib/orgs/members'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string; uid: string }> }

/** PATCH /api/orgs/:publicId/members/:uid `{role}` */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId, uid } = await ctx.params
  let body: { role?: unknown; departmentId?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const role = body.role as OrgRole | undefined
  const hasDept = 'departmentId' in body
  const departmentId =
    body.departmentId === null
      ? null
      : typeof body.departmentId === 'string' && body.departmentId.trim()
        ? body.departmentId.trim()
        : undefined

  if (!hasDept && (role == null || !['owner', 'admin', 'member'].includes(role))) {
    return NextResponse.json({ error: 'invalid_role', code: 'invalid_role' }, { status: 400 })
  }

  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: 'admin',
    email: user.email,
    emailVerified: user.emailVerified,
  })
  if (!authz.ok) {
    return NextResponse.json(
      { error: authz.code, code: authz.code },
      { status: authz.code === 'org_not_found' ? 404 : 403 }
    )
  }
  // Only owners may grant/change owner role.
  if (role === 'owner' && authz.role !== 'owner' && authz.role !== 'platform_admin') {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }

  const result = await withTx(async (tx) => {
    if (hasDept) {
      if (departmentId === undefined) {
        return { ok: false as const, code: 'bad_department' as const }
      }
      const dept = await assignMemberDepartment(tx, {
        orgId: authz.org.id,
        userId: uid,
        departmentId,
        actorUserId: user.uid,
      })
      if (dept !== 'ok') {
        return { ok: false as const, code: dept === 'not_found' ? 'not_found' : 'bad_department' }
      }
    }
    if (role) {
      const changed = await setMemberRole(tx, {
        orgId: authz.org.id,
        userId: uid,
        role,
        actorUserId: user.uid,
      })
      if (!changed.ok) return changed
    }
    return { ok: true as const }
  })
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }
  return NextResponse.json({ success: true, role: role ?? undefined })
}

/** DELETE /api/orgs/:publicId/members/:uid — soft-remove. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId, uid } = await ctx.params
  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: 'admin',
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
    removeMember(tx, { orgId: authz.org.id, userId: uid, actorUserId: user.uid })
  )
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }
  return NextResponse.json({ success: true })
}
