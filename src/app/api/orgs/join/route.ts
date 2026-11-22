import { NextRequest, NextResponse } from 'next/server'

import { cancelSubscriptionAtPeriodEndAfterCommit } from '@/lib/billing/cancelSubscriptionAtPeriodEnd'
import { ensureMe } from '@/lib/api/me'
import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { acceptParent } from '@/lib/orgs/acceptParent'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { writeAuditLog } from '@/lib/orgs/auditLog'
import {
  joinOrgAsMember,
  lookupJoinCode,
  userCannotJoinByCode,
} from '@/lib/orgs/joinCodes'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'
import { orgPublicIdFromRequest } from '@/lib/orgs/orgContext'

export const runtime = 'nodejs'

/**
 * POST /api/orgs/join `{code}` — route by DB organizations.kind:
 * - org + individual → join as member
 * - super_org + individual → 422 create_org_first
 * - super_org + org owner (X-OkVevo-Org) → acceptParent
 */
export async function POST(req: NextRequest) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  let body: { code?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ error: 'invalid_code', code: 'invalid_code' }, { status: 400 })
  }

  await ensureMe(user.uid, {
    email: user.emailVerified ? user.email ?? null : null,
    displayName: user.name ?? null,
  })

  const actorOrgPublicId = orgPublicIdFromRequest(req)

  // Org-header path: only for accepting a super-org parent via code.
  if (actorOrgPublicId) {
    const authz = await authorizeOrg(sql, {
      userId: user.uid,
      orgPublicId: actorOrgPublicId,
      need: 'owner',
      email: user.email,
      emailVerified: user.emailVerified,
    })
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.code, code: authz.code },
        { status: authz.code === 'org_not_found' ? 404 : 403 }
      )
    }
    if (authz.org.kind === 'super_org') {
      return NextResponse.json({ error: 'already_super', code: 'already_super' }, { status: 409 })
    }
    if (authz.org.parentId) {
      return NextResponse.json(
        { error: 'already_parented', code: 'already_parented' },
        { status: 409 }
      )
    }

    const txResult = await withTx(async (tx) => {
      const found = await lookupJoinCode(tx, code)
      if (!found) return { ok: false as const, code: 'invalid_code' as const }
      if (found.revokedAt) return { ok: false as const, code: 'revoked' as const }
      if (found.kind !== 'super_org') {
        return { ok: false as const, code: 'not_super_code' as const }
      }
      const accepted = await acceptParent(tx, {
        childOrgId: authz.org.id,
        superOrgId: found.orgId,
      })
      if (!accepted.ok) return accepted
      await writeAuditLog(tx, {
        orgId: authz.org.id,
        actorUserId: user.uid,
        action: 'join_code.accept_parent',
        targetType: 'organization',
        targetId: found.orgId,
        metadata: { joinCodeId: found.joinCodeId },
      })
      return accepted
    })

    if (!txResult.ok) {
      const status =
        txResult.code === 'already_parented'
          ? 409
          : txResult.code === 'invalid_code' || txResult.code === 'revoked'
            ? 400
            : 400
      return NextResponse.json({ error: txResult.code, code: txResult.code }, { status })
    }

    await cancelSubscriptionAtPeriodEndAfterCommit({
      billingAccountId: txResult.billingAccountId,
      razorpaySubscriptionId: txResult.razorpaySubscriptionId,
      reason: 'accept.parent',
    })

    return NextResponse.json({
      success: true,
      action: 'accept_parent',
      allocationBalance: txResult.allocationBalance,
      topUpBalance: txResult.topUpBalance,
      billingAccountId: txResult.billingAccountId,
    })
  }

  // Personal box: individuals only.
  if (await userCannotJoinByCode(sql, user.uid)) {
    return NextResponse.json(
      { error: 'org_cannot_join_by_code', code: 'org_cannot_join_by_code' },
      { status: 403 }
    )
  }

  const result = await withTx(async (tx) => {
    const found = await lookupJoinCode(tx, code)
    if (!found) return { ok: false as const, code: 'invalid_code' as const }
    if (found.revokedAt) return { ok: false as const, code: 'revoked' as const }

    if (found.kind === 'super_org') {
      return { ok: false as const, code: 'create_org_first' as const }
    }

    const joined = await joinOrgAsMember(tx, { orgId: found.orgId, userId: user.uid })
    if (!joined.ok) return joined
    return {
      ok: true as const,
      action: 'join_member' as const,
      orgId: joined.orgId,
      orgPublicId: found.publicId,
      role: joined.role,
    }
  })

  if (!result.ok) {
    if (result.code === 'create_org_first') {
      return NextResponse.json(
        { error: 'create_org_first', code: 'create_org_first' },
        { status: 422 }
      )
    }
    const status =
      result.code === 'rate_limited'
        ? 429
        : result.code === 'already_member'
          ? 409
          : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }

  return NextResponse.json({
    success: true,
    action: result.action,
    orgId: result.orgId,
    orgPublicId: result.orgPublicId,
    role: result.role,
  })
}
