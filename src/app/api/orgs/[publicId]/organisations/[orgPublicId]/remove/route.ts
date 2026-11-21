/**
 * POST /api/orgs/:publicId/organisations/:orgPublicId/remove
 * Super-org owner removes a child organisation.
 */
import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { getBillingByOrgId } from '@/lib/db/wallet'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg, loadOrgByPublicId } from '@/lib/orgs/authorize'
import { leaveOrRemoveParent, previewLeaveDebt } from '@/lib/orgs/leaveOrRemoveParent'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string; orgPublicId: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const authed = await requireAuthed(req)
  if (!isAuthed(authed)) return authed

  const { publicId, orgPublicId } = await ctx.params
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
  if (authz.org.kind !== 'super_org') {
    return NextResponse.json({ error: 'not_super_org', code: 'not_super_org' }, { status: 400 })
  }

  const child = await loadOrgByPublicId(sql, orgPublicId)
  if (!child || child.parentId !== authz.org.id) {
    return NextResponse.json({ error: 'not_child', code: 'not_child' }, { status: 400 })
  }

  const childBilling = await getBillingByOrgId(sql, child.id)
  const previewDebt = previewLeaveDebt(childBilling?.sponsoredBalance ?? 0)

  const result = await withTx((tx) =>
    leaveOrRemoveParent(tx, {
      childOrgId: child.id,
      superOrgId: authz.org.id,
      actorUserId: authed.uid,
      action: 'remove',
    })
  )

  if (!result.ok) {
    if (result.code === 'jobs_in_flight') {
      return NextResponse.json(
        { error: 'jobs_in_flight', code: 'jobs_in_flight', message: 'jobs_in_flight, try again shortly' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: result.code, code: result.code }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    previewDebt,
    debtFromSuperTopUp: result.debtFromSuperTopUp,
    debtAbsorbed: result.debtAbsorbed,
    sponsoredReturned: result.sponsoredReturned,
  })
}
