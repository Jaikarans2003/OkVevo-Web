import { NextRequest, NextResponse } from 'next/server'

import { env } from '@/config/env'
import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { createInvitation } from '@/lib/orgs/invitations'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** POST /api/orgs/:publicId/invitations `{email, role}` — returns invite link once. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  let body: { email?: unknown; role?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid_email', code: 'invalid_email' }, { status: 400 })
  }
  const role =
    body.role === 'owner' || body.role === 'admin' || body.role === 'member'
      ? body.role
      : 'member'

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

  try {
    const created = await withTx((tx) =>
      createInvitation(tx, {
        orgId: authz.org.id,
        email,
        role,
        invitedBy: user.uid,
      })
    )
    const inviteUrl = `${env.siteUrl}/invite/${created.token}`
    return NextResponse.json({
      id: created.id,
      email,
      role,
      expiresAt: created.expiresAt.toISOString(),
      inviteUrl,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'invalid_email') {
      return NextResponse.json({ error: 'invalid_email', code: 'invalid_email' }, { status: 400 })
    }
    throw e
  }
}
