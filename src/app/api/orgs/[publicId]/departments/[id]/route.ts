import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { deleteDepartment, renameDepartment } from '@/lib/orgs/departments'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string; id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId, id } = await ctx.params
  let body: { name?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'invalid_name', code: 'invalid_name' }, { status: 400 })
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

  const result = await withTx((tx) =>
    renameDepartment(tx, { orgId: authz.org.id, departmentId: id, name, actorUserId: user.uid })
  )
  if (!result.ok) {
    const status =
      result.code === 'not_found' ? 404 : result.code === 'duplicate' ? 409 : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId, id } = await ctx.params
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
    deleteDepartment(tx, { orgId: authz.org.id, departmentId: id, actorUserId: user.uid })
  )
  if (result === 'not_found') {
    return NextResponse.json({ error: 'not_found', code: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}