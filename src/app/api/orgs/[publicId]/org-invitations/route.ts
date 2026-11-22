import { NextRequest, NextResponse } from 'next/server'

import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { authorizeOrg, loadOrgByPublicId } from '@/lib/orgs/authorize'
import {
  createOrgInvitation,
  resolveOrgIdByOwnerEmail,
} from '@/lib/orgs/orgInvitations'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ publicId: string }> }

/** GET — pending org invitations sent by this super-org. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: 'admin',
    email: user.email,
    emailVerified: user.emailVerified,
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

  const rows = await sql`
    select oi.id, oi.status, oi.created_at, o.public_id, o.name
    from org_invitations oi
    join organizations o on o.id = oi.org_id
    where oi.super_org_id = ${authz.org.id} and oi.status = 'pending'
    order by oi.created_at desc
  `
  return NextResponse.json({
    items: rows.map((r) => ({
      id: String(r.id),
      orgPublicId: String(r.public_id),
      orgName: String(r.name),
      createdAt: new Date(String(r.created_at)).toISOString(),
    })),
  })
}

/** POST — invite existing org by public id or owner email. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  const { publicId } = await ctx.params
  let body: { orgPublicId?: unknown; ownerEmail?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const authz = await authorizeOrg(sql, {
    userId: user.uid,
    orgPublicId: publicId,
    need: 'admin',
    email: user.email,
    emailVerified: user.emailVerified,
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

  const orgPublicId = typeof body.orgPublicId === 'string' ? body.orgPublicId.trim() : ''
  const ownerEmail = typeof body.ownerEmail === 'string' ? body.ownerEmail.trim() : ''

  const result = await withTx(async (tx) => {
    let targetOrgId: string | null = null
    if (orgPublicId) {
      const org = await loadOrgByPublicId(tx, orgPublicId)
      if (!org) return { ok: false as const, code: 'org_not_found' as const }
      targetOrgId = org.id
    } else if (ownerEmail) {
      const resolved = await resolveOrgIdByOwnerEmail(tx, ownerEmail)
      if (!resolved.ok) return { ok: false as const, code: resolved.code }
      targetOrgId = resolved.orgId
    } else {
      return { ok: false as const, code: 'invalid_target' as const }
    }
    return createOrgInvitation(tx, {
      superOrgId: authz.org.id,
      targetOrgId,
      invitedBy: user.uid,
    })
  })

  if (!result.ok) {
    const status =
      result.code === 'pending_exists' ||
      result.code === 'already_parented' ||
      result.code === 'ambiguous_owner_email'
        ? 409
        : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }
  return NextResponse.json({ success: true, id: result.id }, { status: 201 })
}