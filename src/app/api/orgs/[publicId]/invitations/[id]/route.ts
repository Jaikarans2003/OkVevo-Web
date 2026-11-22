import { NextRequest, NextResponse } from 'next/server'

import { env } from '@/config/env'
import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { resendInvitation, revokeInvitation } from '@/lib/orgs/invitations'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string; id: string }> }

/** DELETE — revoke pending invitation. */
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
    revokeInvitation(tx, { orgId: authz.org.id, invitationId: id, actorUserId: user.uid })
  )
  if (result === 'not_found') {
    return NextResponse.json({ error: 'not_found', code: 'not_found' }, { status: 404 })
  }
  if (result === 'not_pending') {
    return NextResponse.json({ error: 'not_pending', code: 'not_pending' }, { status: 409 })
  }
  return NextResponse.json({ success: true })
}

/** POST — resend (new token). Same role gate as create: admin→member only. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId, id } = await ctx.params
  const authzAdmin = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: 'admin',
    email: user.email,
    emailVerified: user.emailVerified,
  })
  if (!authzAdmin.ok) {
    return NextResponse.json(
      { error: authzAdmin.code, code: authzAdmin.code },
      { status: authzAdmin.code === 'org_not_found' ? 404 : 403 }
    )
  }

  const inviteRows = await sql`
    select role from invitations
    where id = ${id} and org_id = ${authzAdmin.org.id}
      and accepted_at is null and revoked_at is null
  `
  const inviteRole = inviteRows[0]?.role as string | undefined
  if (!inviteRole) {
    return NextResponse.json({ error: 'not_found', code: 'not_found' }, { status: 404 })
  }
  if (
    (inviteRole === 'admin' || inviteRole === 'owner') &&
    authzAdmin.role !== 'owner' &&
    authzAdmin.role !== 'platform_admin'
  ) {
    return NextResponse.json({ error: 'org_access_denied', code: 'org_access_denied' }, { status: 403 })
  }

  const result = await withTx((tx) =>
    resendInvitation(tx, {
      orgId: authzAdmin.org.id,
      invitationId: id,
      actorUserId: user.uid,
    })
  )
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 409
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }
  const inviteUrl = `${env.siteUrl}/invite/${result.token}`
  return NextResponse.json({
    success: true,
    id: result.id,
    expiresAt: result.expiresAt.toISOString(),
    inviteUrl,
  })
}