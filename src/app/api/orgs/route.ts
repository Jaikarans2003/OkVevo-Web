import { NextRequest, NextResponse } from 'next/server'

import { env } from '@/config/env'
import { sendEmail } from '@/lib/email/sendEmail'
import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { auth } from '@/lib/firebase-admin'
import { ensureMe } from '@/lib/api/me'
import { gatewayIdToken } from '@/lib/gateway/auth'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { createChildOrg } from '@/lib/orgs/createChildOrg'

export const runtime = 'nodejs'

/**
 * POST /api/orgs — create a child org under a super-org (`parent` = public id).
 * `ownerEmail` receives a pending owner invite (caller is not the child owner).
 */
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

  let body: { name?: unknown; parent?: unknown; kind?: unknown; ownerEmail?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (body.kind === 'super_org') {
    return NextResponse.json(
      { error: 'forbidden', code: 'cannot_create_super_org' },
      { status: 403 }
    )
  }

  const parentPublicId = typeof body.parent === 'string' ? body.parent.trim() : ''
  if (!parentPublicId) {
    return NextResponse.json(
      { error: 'parent_required', code: 'parent_required' },
      { status: 400 }
    )
  }
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'invalid_name', code: 'invalid_name' }, { status: 400 })
  }
  const ownerEmail =
    typeof body.ownerEmail === 'string' && body.ownerEmail.trim()
      ? body.ownerEmail.trim()
      : typeof decoded.email === 'string' && decoded.email_verified
        ? decoded.email.trim()
        : ''
  if (!ownerEmail) {
    return NextResponse.json({ error: 'invalid_owner_email', code: 'invalid_owner_email' }, { status: 400 })
  }

  await ensureMe(decoded.uid, {
    email: decoded.email_verified === true ? decoded.email ?? null : null,
    displayName: decoded.name ?? null,
  })

  const authz = await authorizeOrg(sql, {
    userId: decoded.uid,
    orgPublicId: parentPublicId,
    need: 'admin',
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
    return NextResponse.json(
      { error: 'parent_not_super_org', code: 'parent_not_super_org' },
      { status: 400 }
    )
  }

  const result = await withTx((tx) =>
    createChildOrg(tx, {
      parentOrgId: authz.org.id,
      name: body.name as string,
      ownerEmail,
      createdBy: decoded.uid,
    })
  )

  if (!result.ok) {
    const status =
      result.code === 'forbidden'
        ? 403
        : result.code === 'invalid_name' || result.code === 'invalid_owner_email'
          ? 400
          : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }

  const inviteUrl = `${env.siteUrl}/invite/${result.ownerInviteToken}`
  await sendEmail({
    to: ownerEmail,
    subject: `You are invited to own ${body.name as string} on OkVevo`,
    text: inviteUrl,
  })

  return NextResponse.json({
    success: true,
    orgPublicId: result.orgPublicId,
    orgId: result.orgId,
    billingAccountId: result.billingAccountId,
    ownerInviteId: result.ownerInviteId,
    inviteUrl,
  })
}