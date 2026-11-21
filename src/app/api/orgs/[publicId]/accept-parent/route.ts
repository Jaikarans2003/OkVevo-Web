/**
 * POST /api/orgs/:publicId/accept-parent — set parent_id + prepaid (2b-a wallet).
 * Body: { superOrgPublicId }.
 *
 * Until 2b-b: platform-admin only (staging L2 uses the L2 admin). 2b-b replaces
 * this with the org_invitations check — parent-initiated only (super-org invites
 * by org public id or owner email; org owner accepts/declines; no org-initiated
 * join request).
 */
import { NextRequest, NextResponse } from 'next/server'

import { isPlatformAdmin } from '@/lib/api/me'
import { cancelSubscriptionAtPeriodEndAfterCommit } from '@/lib/billing/cancelSubscriptionAtPeriodEnd'
import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { acceptParent } from '@/lib/orgs/acceptParent'
import { authorizeOrg, loadOrgByPublicId } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const authed = await requireAuthed(req)
  if (!isAuthed(authed)) return authed

  // 2b-b: replace with org_invitations accept/decline for the invited org owner.
  if (
    !isPlatformAdmin({
      email: authed.email,
      email_verified: authed.emailVerified,
    })
  ) {
    return NextResponse.json({ error: 'forbidden', code: 'forbidden' }, { status: 403 })
  }

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

  const result = await withTx((tx) =>
    acceptParent(tx, { childOrgId: authz.org.id, superOrgId: superOrg.id })
  )
  if (!result.ok) {
    const status = result.code === 'already_parented' ? 409 : 400
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
