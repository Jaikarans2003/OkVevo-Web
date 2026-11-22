import { NextRequest, NextResponse } from 'next/server'

import { ensureMe } from '@/lib/api/me'
import { withTx } from '@/lib/db/tx'
import { acceptInvitation, getInvitationByIdForAccept } from '@/lib/orgs/invitations'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

/** POST /api/invitations/accept `{token}` — verified email must match invite. */
export async function POST(req: NextRequest) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  let body: { token?: unknown; invitationId?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const invitationId =
    typeof body.invitationId === 'string' && body.invitationId.trim()
      ? body.invitationId.trim()
      : ''
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token && !invitationId) {
    return NextResponse.json({ error: 'invalid_token', code: 'invalid_token' }, { status: 400 })
  }

  await ensureMe(user.uid, {
    email: user.emailVerified ? user.email ?? null : null,
    displayName: user.name ?? null,
  })

  const result = await withTx((tx) =>
    invitationId
      ? getInvitationByIdForAccept(tx, {
          invitationId,
          userId: user.uid,
          email: user.email ?? '',
          emailVerified: user.emailVerified,
        })
      : acceptInvitation(tx, {
          token,
          userId: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
        })
  )

  if (!result.ok) {
    const status =
      result.code === 'email_unverified' || result.code === 'email_mismatch'
        ? 403
        : result.code === 'already_accepted'
          ? 409
          : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }

  return NextResponse.json({
    success: true,
    orgId: result.orgId,
    role: result.role,
  })
}
