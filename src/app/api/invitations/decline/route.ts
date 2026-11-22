import { NextRequest, NextResponse } from 'next/server'

import { ensureMe } from '@/lib/api/me'
import { withTx } from '@/lib/db/tx'
import { declineInvitation, declineInvitationById } from '@/lib/orgs/invitations'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

/** POST /api/invitations/decline `{token}` or `{invitationId}` */
export async function POST(req: NextRequest) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  let body: { token?: unknown; invitationId?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  await ensureMe(user.uid, {
    email: user.emailVerified ? user.email ?? null : null,
    displayName: user.name ?? null,
  })

  const invitationId =
    typeof body.invitationId === 'string' && body.invitationId.trim()
      ? body.invitationId.trim()
      : ''
  const token = typeof body.token === 'string' ? body.token.trim() : ''

  const result = await withTx((tx) =>
    invitationId
      ? declineInvitationById(tx, {
          invitationId,
          userId: user.uid,
          email: user.email ?? '',
          emailVerified: user.emailVerified,
        })
      : declineInvitation(tx, {
          token,
          userId: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
        })
  )

  if (!result.ok) {
    const status =
      result.code === 'email_unverified' || result.code === 'email_mismatch' ? 403 : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }

  return NextResponse.json({ success: true })
}