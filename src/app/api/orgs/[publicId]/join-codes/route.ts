import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { createJoinCode } from '@/lib/orgs/joinCodes'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** POST /api/orgs/:publicId/join-codes — admin+; returns plaintext code once. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  let body: { role?: unknown; maxUses?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    /* empty body ok */
  }

  const role = body.role === 'admin' ? 'admin' : 'member'
  const maxUses =
    body.maxUses == null
      ? null
      : Number.isInteger(Number(body.maxUses)) && Number(body.maxUses) > 0
        ? Number(body.maxUses)
        : null

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

  const created = await withTx((tx) =>
    createJoinCode(tx, {
      orgId: authz.org.id,
      createdBy: user.uid,
      role,
      maxUses,
    })
  )

  return NextResponse.json({
    id: created.id,
    code: created.code,
    expiresAt: created.expiresAt.toISOString(),
    role,
    maxUses,
  })
}
