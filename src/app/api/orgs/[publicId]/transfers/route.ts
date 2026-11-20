import { NextRequest, NextResponse } from 'next/server'

import { withTx } from '@/lib/db/tx'
import { auth } from '@/lib/firebase-admin'
import { gatewayIdToken } from '@/lib/gateway/auth'
import { authorizeOrg, loadOrgByPublicId } from '@/lib/orgs/authorize'
import { transferCredits } from '@/lib/orgs/transferCredits'
import { sql } from '@/lib/db/client'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** POST /api/orgs/:publicId/transfers — super-org owner sends top-up credits to a child. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const token = gatewayIdToken(req)
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let decoded: { uid: string; email?: string; email_verified?: boolean }
  try {
    decoded = await auth.verifyIdToken(token)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { publicId } = await ctx.params
  let body: { toOrg?: unknown; credits?: unknown; idempotencyKey?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const toOrgPublicId = typeof body.toOrg === 'string' ? body.toOrg : ''
  const credits = typeof body.credits === 'number' ? body.credits : Number(body.credits)
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''

  if (!toOrgPublicId || !idempotencyKey || !Number.isInteger(credits) || credits <= 0) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const authz = await authorizeOrg(sql, {
    userId: decoded.uid,
    orgPublicId: publicId,
    need: 'owner',
    email: decoded.email,
    emailVerified: decoded.email_verified === true,
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

  const child = await loadOrgByPublicId(sql, toOrgPublicId)
  if (!child) {
    return NextResponse.json({ error: 'org_not_found', code: 'org_not_found' }, { status: 404 })
  }

  const result = await withTx((tx) =>
    transferCredits(tx, {
      fromSuperOrgId: authz.org.id,
      toOrgId: child.id,
      credits,
      idempotencyKey,
      actorUserId: decoded.uid,
    })
  )

  if (!result.ok) {
    const status =
      result.code === 'insufficient_quota'
        ? 402
        : result.code === 'idempotency_conflict'
          ? 409
          : result.code === 'plan_not_active'
            ? 403
            : result.code === 'not_child' || result.code === 'not_found'
              ? 403
              : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }

  return NextResponse.json({
    success: true,
    transferred: result.transferred,
    debtRecovered: result.debtRecovered,
    fromBalance: result.fromBalance,
    toBalance: result.toBalance,
    idempotent: result.idempotent,
  })
}
