import { NextRequest, NextResponse } from 'next/server'

import { cancelSubscriptionAtPeriodEndAfterCommit } from '@/lib/billing/cancelSubscriptionAtPeriodEnd'
import { sql } from '@/lib/db/client'
import { getBillingByUserId, getBillingByOrgId } from '@/lib/db/wallet'
import { withTx } from '@/lib/db/tx'
import { auth } from '@/lib/firebase-admin'
import { gatewayIdToken } from '@/lib/gateway/auth'
import { ensureMe } from '@/lib/api/me'
import { upgradeIndividualToOrg } from '@/lib/orgs/upgrade'

export const runtime = 'nodejs'

/** POST /api/me/upgrade — one-way individual → organisation (same wallet). */
export async function POST(req: NextRequest) {
  const token = gatewayIdToken(req)
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let decoded: { uid: string; email?: string; name?: string; email_verified?: boolean }
  try {
    decoded = await auth.verifyIdToken(token)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { name?: unknown }
  try {
    body = (await req.json()) as { name?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
  }

  await ensureMe(decoded.uid, {
    email: decoded.email_verified === true ? decoded.email ?? null : null,
    displayName: decoded.name ?? null,
  })

  const before = await getBillingByUserId(sql, decoded.uid)
  const priorSubId = before?.razorpaySubscriptionId ?? null

  const result = await withTx((tx) =>
    upgradeIndividualToOrg(tx, {
      userId: decoded.uid,
      name: body.name as string,
    })
  )

  if (!result.ok) {
    if (result.code === 'already_upgraded') {
      return NextResponse.json({ error: 'already_upgraded' }, { status: 409 })
    }
    if (result.code === 'invalid_name') {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
    }
    return NextResponse.json({ error: result.code }, { status: 400 })
  }

  const orgWallet = await getBillingByOrgId(sql, result.orgId)
  if (orgWallet && priorSubId) {
    await cancelSubscriptionAtPeriodEndAfterCommit({
      billingAccountId: orgWallet.id,
      razorpaySubscriptionId: priorSubId,
      reason: 'upgrade.individual_to_org',
    })
  }

  return NextResponse.json({
    success: true,
    orgPublicId: result.orgPublicId,
    orgId: result.orgId,
  })
}
