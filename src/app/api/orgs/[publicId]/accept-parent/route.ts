/**
 * POST /api/orgs/:publicId/accept-parent — org owner accepts super-org invitation.
 * Body: { superOrgPublicId }.
 */
import { NextRequest, NextResponse } from 'next/server'

import { cancelSubscriptionAtPeriodEndAfterCommit } from '@/lib/billing/cancelSubscriptionAtPeriodEnd'
import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { acceptParent } from '@/lib/orgs/acceptParent'
import { authorizeOrg, loadOrgByPublicId } from '@/lib/orgs/authorize'
import {
  findPendingOrgInvitation,
  markOrgInvitationAccepted,
} from '@/lib/orgs/orgInvitations'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'
import { writeAuditLog } from '@/lib/orgs/auditLog'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

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
  if (authz.org.kind !== 'org') {
    return NextResponse.json({ error: 'not_org', code: 'not_org' }, { status: 400 })
  }

  const superOrg = await loadOrgByPublicId(sql, superOrgPublicId)
  if (!superOrg || superOrg.kind !== 'super_org') {
    return NextResponse.json({ error: 'bad_super', code: 'bad_super' }, { status: 400 })
  }

  const result = await withTx(async (tx) => {
    const pending = await findPendingOrgInvitation(tx, {
      childOrgId: authz.org.id,
      superOrgId: superOrg.id,
    })
    if (!pending) {
      return { ok: false as const, code: 'no_pending_invitation' as const }
    }
    const accepted = await acceptParent(tx, { childOrgId: authz.org.id, superOrgId: superOrg.id })
    if (!accepted.ok) return accepted
    await markOrgInvitationAccepted(tx, { invitationId: pending.id })
    await writeAuditLog(tx, {
      orgId: authz.org.id,
      actorUserId: authed.uid,
      action: 'org_invitation.accept',
      targetType: 'organization',
      targetId: superOrg.id,
      metadata: { invitationId: pending.id },
    })
    return accepted
  })

  if (!result.ok) {
    const status =
      result.code === 'already_parented' || result.code === 'no_pending_invitation' ? 409 : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }

  await cancelSubscriptionAtPeriodEndAfterCommit({
    billingAccountId: result.billingAccountId,
    razorpaySubscriptionId: result.razorpaySubscriptionId,
    reason: 'accept.parent',
  })

  return NextResponse.json({
    success: true,
    allocationBalance: result.allocationBalance,
    topUpBalance: result.topUpBalance,
    billingAccountId: result.billingAccountId,
  })
}