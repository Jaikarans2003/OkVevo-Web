import { NextRequest, NextResponse } from 'next/server'

import { ensureMe, isPlatformAdmin } from '@/lib/api/me'
import { withTx } from '@/lib/db/tx'
import { auth } from '@/lib/firebase-admin'
import { gatewayIdToken } from '@/lib/gateway/auth'
import { approveSuperOrgApplication } from '@/lib/orgs/approveSuperOrg'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/admin/super-org-applications/:id/approve — platform admin only. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const token = gatewayIdToken(req)
  if (!token) {
    return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 })
  }
  let decoded: { uid: string; email?: string; name?: string; email_verified?: boolean }
  try {
    decoded = await auth.verifyIdToken(token)
  } catch {
    return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 })
  }

  if (
    !isPlatformAdmin({
      email: decoded.email,
      email_verified: decoded.email_verified === true,
    })
  ) {
    return NextResponse.json({ error: 'forbidden', code: 'forbidden' }, { status: 403 })
  }

  await ensureMe(decoded.uid, {
    email: decoded.email_verified === true ? decoded.email ?? null : null,
    displayName: decoded.name ?? null,
  })

  const { id } = await ctx.params
  const result = await withTx((tx) =>
    approveSuperOrgApplication(tx, { applicationId: id, approvedBy: decoded.uid })
  )

  if (!result.ok) {
    const status =
      result.code === 'already_approved'
        ? 409
        : result.code === 'not_found'
          ? 404
          : result.code === 'negative_balance'
            ? 409
            : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }

  return NextResponse.json({
    success: true,
    orgPublicId: result.orgPublicId,
    orgId: result.orgId,
    created: result.created,
  })
}
