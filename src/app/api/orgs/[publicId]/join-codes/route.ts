import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg } from '@/lib/orgs/authorize'
import {
  ensureJoinCode,
  getActiveJoinCode,
  regenerateJoinCode,
} from '@/lib/orgs/joinCodes'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** GET — active join code metadata (plaintext only when first minted via POST). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
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

  const active = await withTx((tx) => ensureJoinCode(tx, { orgId: authz.org.id, createdBy: user.uid }))
  return NextResponse.json({
    id: active.id,
    code: active.code,
    created: active.created,
    role: 'member',
  })
}

/** POST — regenerate join code (revokes previous). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  let body: { role?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    /* empty ok */
  }
  if (body.role != null && body.role !== 'member') {
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

  const meta = await getActiveJoinCode(sql, authz.org.id)
  const created = await withTx((tx) =>
    regenerateJoinCode(tx, { orgId: authz.org.id, actorUserId: user.uid })
  )

  return NextResponse.json({
    id: created.id,
    code: created.code,
    role: 'member',
    previousId: meta?.id ?? null,
  })
}