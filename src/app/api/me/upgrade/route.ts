import { NextRequest, NextResponse } from 'next/server'

import { cancelSubscriptionAtPeriodEndAfterCommit } from '@/lib/billing/cancelSubscriptionAtPeriodEnd'
import { sql } from '@/lib/db/client'
import { getBillingByUserId, getBillingByOrgId } from '@/lib/db/wallet'
import { withTx } from '@/lib/db/tx'
import { auth } from '@/lib/firebase-admin'
import { gatewayIdToken } from '@/lib/gateway/auth'
import { ensureMe } from '@/lib/api/me'
import { createInvitation } from '@/lib/orgs/invitations'
import { upgradeIndividualToOrg } from '@/lib/orgs/upgrade'

export const runtime = 'nodejs'

type UpgradeMemberInput = {
  email: string
  role?: 'admin' | 'member'
  departmentId?: string | null
}

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

  let body: { name?: unknown; members?: unknown }
  try {
    body = (await req.json()) as { name?: unknown; members?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
  }

  const members: UpgradeMemberInput[] = Array.isArray(body.members)
    ? body.members
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m): UpgradeMemberInput => ({
          email: typeof m.email === 'string' ? m.email.trim().toLowerCase() : '',
          role: m.role === 'admin' ? ('admin' as const) : ('member' as const),
          departmentId:
            typeof m.departmentId === 'string' && m.departmentId.trim() ? m.departmentId.trim() : null,
        }))
        .filter((m) => m.email.includes('@'))
    : []

  await ensureMe(decoded.uid, {
    email: decoded.email_verified === true ? decoded.email ?? null : null,
    displayName: decoded.name ?? null,
  })

  const before = await getBillingByUserId(sql, decoded.uid)
  const priorSubId = before?.razorpaySubscriptionId ?? null

  const result = await withTx(async (tx) => {
    const upgraded = await upgradeIndividualToOrg(tx, {
      userId: decoded.uid,
      name: body.name as string,
    })
    if (!upgraded.ok) return upgraded
    for (const m of members) {
      await createInvitation(tx, {
        orgId: upgraded.orgId,
        email: m.email,
        role: m.role ?? 'member',
        invitedBy: decoded.uid,
        departmentId: m.departmentId,
      })
    }
    return upgraded
  })

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
    pendingInvites: members.length,
  })
}