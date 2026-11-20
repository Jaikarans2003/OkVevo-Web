import { NextRequest, NextResponse } from 'next/server'

import { additionalRemainingPct, remainingPct } from '@/types/credits'
import { sql } from '@/lib/db/client'
import { getBillingByOrgId } from '@/lib/db/wallet'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

function walletSummary(billing: Awaited<ReturnType<typeof getBillingByOrgId>>) {
  if (!billing) return null
  return {
    accountKind: billing.accountKind,
    accessMode: billing.accessMode,
    remainingPct: remainingPct(
      billing.creditsIncluded,
      billing.allocationBalance,
      billing.allocationGrantedTotal
    ),
    additionalPct: additionalRemainingPct(billing.topUpBalance, billing.topUpReference),
    canPurchase: billing.accessMode !== 'prepaid',
  }
}

/** GET /api/orgs/:publicId — org, members, wallet %s, children (super-org). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: 'read',
    email: user.email,
    emailVerified: user.emailVerified,
  })
  if (!authz.ok) {
    return NextResponse.json(
      { error: authz.code, code: authz.code },
      { status: authz.code === 'org_not_found' ? 404 : 403 }
    )
  }

  const members = await sql`
    select user_id, role, status, created_at
    from memberships
    where org_id = ${authz.org.id} and status = 'active'
    order by role desc, created_at asc
  `

  const billing = await getBillingByOrgId(sql, authz.org.id)
  let children: Array<Record<string, unknown>> = []
  if (authz.org.kind === 'super_org') {
    const childRows = await sql`
      select id, public_id, name, kind, parent_id
      from organizations
      where parent_id = ${authz.org.id}
      order by created_at asc
    `
    children = []
    for (const c of childRows) {
      const childBilling = await getBillingByOrgId(sql, String(c.id))
      children.push({
        publicId: c.public_id,
        name: c.name,
        kind: c.kind,
        wallet: walletSummary(childBilling),
      })
    }
  }

  return NextResponse.json({
    org: {
      publicId: authz.org.publicId,
      name: authz.org.name,
      kind: authz.org.kind,
      parentId: authz.org.parentId,
    },
    role: authz.role,
    canSpend: authz.canSpend,
    wallet: walletSummary(billing),
    members: members.map((m) => ({
      userId: m.user_id,
      role: m.role,
      createdAt: m.created_at,
    })),
    children,
  })
}
