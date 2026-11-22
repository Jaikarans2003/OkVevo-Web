import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg, loadOrgByPublicId } from '@/lib/orgs/authorize'
import { declineOrgInvitation } from '@/lib/orgs/orgInvitations'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** POST /api/orgs/:publicId/decline-parent — org owner declines super-org invitation. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const authed = await requireAuthed(req)
  if (!isAuthed(authed)) return authed

  const { publicId } = await ctx.params
  let body: { superOrgPublicId?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json', code: 'invalid_json' }, { status: 400 })
  }
  const superOrgPublicId =
    typeof body.superOrgPublicId === 'string' ? body.superOrgPublicId.trim() : ''
  if (!superOrgPublicId) {
    return NextResponse.json({ error: 'invalid_body', code: 'invalid_body' }, { status: 400 })
  }

  const authz = await authorizeOrg(sql, {
    userId: authed.uid,
    orgPublicId: publicId,
    need: 'owner',
    email: authed.email,
    emailVerified: authed.emailVerified,
  })
  if (!authz.ok) {
    return NextResponse.json(
      { error: authz.code, code: authz.code },
      { status: authz.code === 'org_not_found' ? 404 : 403 }
    )
  }

  const superOrg = await loadOrgByPublicId(sql, superOrgPublicId)
  if (!superOrg || superOrg.kind !== 'super_org') {
    return NextResponse.json({ error: 'bad_super', code: 'bad_super' }, { status: 400 })
  }

  const result = await withTx((tx) =>
    declineOrgInvitation(tx, {
      childOrgId: authz.org.id,
      superOrgId: superOrg.id,
      actorUserId: authed.uid,
    })
  )
  if (result === 'not_found') {
    return NextResponse.json({ error: 'no_pending_invitation', code: 'no_pending_invitation' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}