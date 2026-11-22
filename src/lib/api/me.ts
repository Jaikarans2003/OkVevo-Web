/**
 * GET/PATCH /api/me helpers. Lazy-creates users + personal billing_accounts.
 */
import { sql } from '@/lib/db/client'
import { ensureUserAndBilling } from '@/lib/db/wallet'

export type MeUser = {
  id: string
  email: string | null
  displayName: string | null
  phoneNumber: string | null
  bio: string | null
}

export type MeMembership = {
  orgPublicId: string
  name: string
  kind: 'org' | 'super_org'
  role: 'owner' | 'admin' | 'member'
  parent: string | null
}

export type MePendingInvite = {
  invitationId: string
  orgPublicId: string
  orgName: string
  role: string
  expiresAt: string
}

export type MePendingOrgInvitation = {
  id: string
  superOrgPublicId: string
  superOrgName: string
  orgPublicId: string
  createdAt: string
}

export type MePayload = {
  user: MeUser
  memberships: MeMembership[]
  hidePersonal: boolean
  upgradedOrgPublicId: string | null
  isPlatformAdmin: boolean
  pendingInvites: MePendingInvite[]
  pendingOrgInvitations: MePendingOrgInvitation[]
}

export function isPlatformAdmin(decoded: {
  email?: string | null
  email_verified?: boolean
}): boolean {
  if (!decoded.email || decoded.email_verified !== true) return false
  const allow = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return allow.includes(decoded.email)
}

/** Ensure rows exist; stamp verified token email when present. */
export async function ensureMe(
  uid: string,
  opts?: { email?: string | null; displayName?: string | null }
): Promise<MeUser> {
  await ensureUserAndBilling(sql, uid)
  const email = opts?.email?.trim() || null
  const displayName = opts?.displayName?.trim() || null
  if (email) {
    await sql`
      update users
      set email = ${email},
          display_name = coalesce(nullif(display_name, ''), ${displayName}),
          updated_at = now()
      where id = ${uid}
    `
  } else if (displayName) {
    await sql`
      update users
      set display_name = coalesce(nullif(display_name, ''), ${displayName}),
          updated_at = now()
      where id = ${uid}
    `
  }
  const rows = await sql`
    select id, email, display_name, phone_number, bio from users where id = ${uid}
  `
  const row = rows[0] as Record<string, unknown>
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    phoneNumber: (row.phone_number as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
  }
}

export async function getMePayload(
  uid: string,
  decoded: { email?: string | null; email_verified?: boolean; name?: string | null }
): Promise<MePayload> {
  const user = await ensureMe(uid, {
    email: decoded.email_verified === true ? decoded.email ?? null : null,
    displayName: decoded.name ?? null,
  })

  const upgradedRows = await sql`
    select u.upgraded_org_id, o.public_id as upgraded_public_id
    from users u
    left join organizations o on o.id = u.upgraded_org_id
    where u.id = ${uid}
  `
  const upgradedOrgPublicId =
    (upgradedRows[0]?.upgraded_public_id as string | null | undefined) ?? null
  const hidePersonal = upgradedOrgPublicId != null

  const memRows = await sql`
    select o.public_id, o.name, o.kind, m.role, p.public_id as parent_public_id
    from memberships m
    join organizations o on o.id = m.org_id
    left join organizations p on p.id = o.parent_id
    where m.user_id = ${uid} and m.status = 'active'
    order by o.created_at asc
  `
  const memberships: MeMembership[] = memRows.map((row) => ({
    orgPublicId: String(row.public_id),
    name: String(row.name),
    kind: row.kind as 'org' | 'super_org',
    role: row.role as 'owner' | 'admin' | 'member',
    parent: (row.parent_public_id as string | null) ?? null,
  }))

  let pendingInvites: MePendingInvite[] = []
  if (decoded.email_verified === true && decoded.email) {
    const { listPendingInvitesWithTokensForEmail } = await import('@/lib/orgs/invitations')
    const rows = await listPendingInvitesWithTokensForEmail(sql, { email: decoded.email })
    pendingInvites = rows.map((r) => ({
      invitationId: r.invitationId,
      orgPublicId: r.orgPublicId,
      orgName: r.orgName,
      role: r.role,
      expiresAt: r.expiresAt,
    }))
  }

  const orgInviteRows =
    decoded.email_verified === true
      ? await sql`
          select oi.id,
                 oi.created_at,
                 child.public_id as org_public_id,
                 super.public_id as super_public_id,
                 super.name as super_name
          from org_invitations oi
          join organizations child on child.id = oi.org_id
          join organizations super on super.id = oi.super_org_id
          join memberships m on m.org_id = child.id and m.user_id = ${uid} and m.status = 'active' and m.role = 'owner'
          where oi.status = 'pending'
          order by oi.created_at asc
        `
      : []

  const pendingOrgInvitations: MePendingOrgInvitation[] = orgInviteRows.map((row) => ({
    id: String(row.id),
    orgPublicId: String(row.org_public_id),
    superOrgPublicId: String(row.super_public_id),
    superOrgName: String(row.super_name),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }))

  return {
    user,
    memberships,
    hidePersonal,
    upgradedOrgPublicId,
    isPlatformAdmin: isPlatformAdmin(decoded),
    pendingInvites,
    pendingOrgInvitations,
  }
}

export type PatchMeInput = {
  displayName?: string
  phoneNumber?: string
  bio?: string
}

/** Update profile fields. Empty string clears phone/bio; displayName trims. */
export async function patchMe(uid: string, input: PatchMeInput): Promise<MeUser> {
  await ensureUserAndBilling(sql, uid)
  const patch: Record<string, string | null> = {}
  if (input.displayName !== undefined) {
    patch.display_name = input.displayName.trim() || null
  }
  if (input.phoneNumber !== undefined) {
    patch.phone_number = input.phoneNumber.trim() || null
  }
  if (input.bio !== undefined) {
    patch.bio = input.bio.trim() || null
  }
  if (Object.keys(patch).length > 0) {
    await sql`update users set ${sql(patch)}, updated_at = now() where id = ${uid}`
  }
  const rows = await sql`
    select id, email, display_name, phone_number, bio from users where id = ${uid}
  `
  const row = rows[0] as Record<string, unknown>
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    phoneNumber: (row.phone_number as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
  }
}
