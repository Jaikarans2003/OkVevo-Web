import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { getBillingByOrgId } from '@/lib/db/wallet'
import { writeAuditLog } from '@/lib/orgs/auditLog'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { computeCreditLimit } from '@/lib/orgs/creditLimit'
import { overdrawnPct } from '@/lib/orgs/dashboardHelpers'
import {
  buildAdminExactCredits,
  buildChildOrgRow,
  loadMemberDashboardRows,
  walletPctSummary,
} from '@/lib/orgs/orgDashboard'
import { usagePeriodWindow } from '@/lib/orgs/periodWindow'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** Owner / platform / inherited_read may see full member list + per-member usage. */
function canSeeMembersList(role: string): boolean {
  return (
    role === 'owner' ||
    role === 'inherited_read' ||
    role === 'platform_admin'
  )
}

/** Exact balances only for direct owner / platform — never inherited_read. */
function canSeeExact(role: string): boolean {
  return role === 'owner' || role === 'platform_admin'
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

  const membersList = canSeeMembersList(authz.role)
  const exactOk = canSeeExact(authz.role)
  const billing = await getBillingByOrgId(sql, authz.org.id)
  const now = new Date()

  let parentName: string | null = null
  if (authz.org.parentId) {
    const parentRows = await sql`
      select name from organizations where id = ${authz.org.parentId}
    `
    parentName = parentRows[0] ? String(parentRows[0].name) : null
  }

  const creditLimit = billing ? await computeCreditLimit(sql, billing.id, now) : 0
  const walletBase = walletPctSummary(billing)
  const wallet = walletBase
    ? {
        ...walletBase,
        overdrawnPct: billing ? overdrawnPct(billing.sponsoredBalance, creditLimit) : 0,
        fundedBy: parentName,
      }
    : null

  const children: Array<Record<string, unknown>> = []
  const childSponsored: number[] = []
  if (authz.org.kind === 'super_org') {
    const childRows = await sql`
      select id, public_id, name, kind
      from organizations
      where parent_id = ${authz.org.id}
      order by created_at asc
    `
    for (const c of childRows) {
      const childBilling = await getBillingByOrgId(sql, String(c.id))
      const row = await buildChildOrgRow(sql, {
        publicId: String(c.public_id),
        name: String(c.name),
        kind: String(c.kind),
        billing: childBilling ?? null,
        now,
      })
      childSponsored.push(childBilling?.sponsoredBalance ?? 0)
      if (exactOk) {
        children.push({
          publicId: row.publicId,
          name: row.name,
          kind: row.kind,
          wallet: row.wallet,
          active: row.active,
          creditsUsed: row.creditsUsed,
          memberCount: row.memberCount,
          owesPct: row.owesPct,
          owesCredits: row.owesCredits,
        })
      } else {
        children.push({
          publicId: row.publicId,
          name: row.name,
          kind: row.kind,
          wallet: row.wallet
            ? {
                accountKind: row.wallet.accountKind,
                accessMode: row.wallet.accessMode,
                remainingPct: row.wallet.remainingPct,
                additionalPct: row.wallet.additionalPct,
                sponsoredPct: row.wallet.sponsoredPct,
                canPurchase: row.wallet.canPurchase,
              }
            : null,
        })
      }
    }
  }

  let members: Array<Record<string, unknown>>
  if (membersList && billing) {
    const window = usagePeriodWindow({
      accessMode: billing.accessMode,
      billingCycle: billing.billingCycle,
      currentPeriodEnd: billing.currentPeriodEnd,
      now,
    })
    members = await loadMemberDashboardRows(sql, {
      orgId: authz.org.id,
      billingAccountId: billing.id,
      window,
    })
  } else if (membersList) {
    const rows = await sql`
      select user_id, role, status, created_at
      from memberships
      where org_id = ${authz.org.id} and status = 'active'
      order by role desc, created_at asc
    `
    members = rows.map((m) => ({
      userId: m.user_id,
      role: m.role,
      createdAt: m.created_at,
    }))
  } else {
    const rows = await sql`
      select user_id, role, status, created_at
      from memberships
      where org_id = ${authz.org.id}
        and user_id = ${user.uid}
        and status = 'active'
    `
    members = rows.map((m) => ({
      userId: m.user_id,
      role: m.role,
      createdAt: m.created_at,
    }))
  }

  const body: Record<string, unknown> = {
    org: {
      publicId: authz.org.publicId,
      name: authz.org.name,
      kind: authz.org.kind,
      parentId: authz.org.parentId,
      parentName,
    },
    role: authz.role,
    canSpend: authz.canSpend,
    wallet,
    members,
    children,
  }

  if (exactOk) {
    body.exact = await buildAdminExactCredits(sql, {
      billing: billing ?? null,
      childrenSponsoredBalances: childSponsored,
      parentName,
      creditLimit,
    })
    if (billing) {
      const window = usagePeriodWindow({
        accessMode: billing.accessMode,
        billingCycle: billing.billingCycle,
        currentPeriodEnd: billing.currentPeriodEnd,
        now,
      })
      const periodUsage = await sql`
        select coalesce(sum(credits), 0)::int as credits
        from usage_daily
        where org_id = ${authz.org.id}
          and day >= ${window.from}
          and day < ${window.to}
      `
      body.period = {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        creditsUsed: Number(periodUsage[0]?.credits ?? 0),
        activeMemberCount: members.length,
      }
    }
  }

  return NextResponse.json(body)
}

/** PATCH /api/orgs/:publicId `{name}` — owner rename. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  let body: { name?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'invalid_name', code: 'invalid_name' }, { status: 400 })
  }

  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
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

  await withTx(async (tx) => {
    const rows = await tx`
      select name from organizations where id = ${authz.org.id} for update
    `
    const from = String(rows[0]?.name ?? '')
    await tx`
      update organizations
      set name = ${name}
      where id = ${authz.org.id}
    `
    if (from !== name) {
      await writeAuditLog(tx, {
        orgId: authz.org.id,
        actorUserId: user.uid,
        action: 'org.rename',
        targetType: 'organization',
        targetId: authz.org.id,
        metadata: { from, to: name },
      })
    }
  })
  return NextResponse.json({ success: true, name })
}
