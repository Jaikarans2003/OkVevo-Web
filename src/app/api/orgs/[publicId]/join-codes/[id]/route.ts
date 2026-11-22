import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { revokeJoinCode } from '@/lib/orgs/joinCodes'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string; id: string }> }

/** DELETE /api/orgs/:publicId/join-codes/:id — deactivate. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId, id } = await ctx.params
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
    revokeJoinCode(tx, { orgId: authz.org.id, joinCodeId: id, actorUserId: user.uid })
  )
  if (result === 'not_found') {
    return NextResponse.json({ error: 'not_found', code: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}