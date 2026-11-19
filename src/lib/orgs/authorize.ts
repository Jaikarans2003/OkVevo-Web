/**
 * Org access: active membership with enough role, OR owner/admin on parent
 * super-org (inherited admin — never spending), OR platform admin.
 */
import type { DbHandle } from '@/lib/db/wallet'
import { isPlatformAdmin } from '@/lib/api/me'

export type OrgRole = 'owner' | 'admin' | 'member'
export type OrgNeed = 'read' | 'admin' | 'owner' | 'spend'

export type OrgRow = {
  id: string
  publicId: string
  kind: 'org' | 'super_org'
  parentId: string | null
  name: string
}

const ROLE_RANK: Record<OrgRole, number> = { member: 1, admin: 2, owner: 3 }

function needRank(need: OrgNeed): number {
  if (need === 'read' || need === 'spend') return ROLE_RANK.member
  if (need === 'admin') return ROLE_RANK.admin
  return ROLE_RANK.owner
}

export async function loadOrgByPublicId(
  db: DbHandle,
  publicId: string
): Promise<OrgRow | null> {
  const rows = await db`
    select id, public_id, kind, parent_id, name
    from organizations
    where public_id = ${publicId}
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    kind: row.kind as 'org' | 'super_org',
    parentId: (row.parent_id as string | null) ?? null,
    name: String(row.name),
  }
}

export type AuthorizeOk = {
  ok: true
  org: OrgRow
  role: OrgRole | 'platform_admin' | 'inherited_admin'
  /** Only active members of this org (or platform admin) may spend its wallet. */
  canSpend: boolean
}

export type AuthorizeFail = { ok: false; code: 'org_not_found' | 'org_access_denied' }

export async function authorizeOrg(
  db: DbHandle,
  opts: {
    userId: string
    orgPublicId: string
    need: OrgNeed
    email?: string | null
    emailVerified?: boolean
  }
): Promise<AuthorizeOk | AuthorizeFail> {
  const org = await loadOrgByPublicId(db, opts.orgPublicId)
  if (!org) return { ok: false, code: 'org_not_found' }

  if (
    isPlatformAdmin({
      email: opts.email,
      email_verified: opts.emailVerified === true,
    })
  ) {
    return { ok: true, org, role: 'platform_admin', canSpend: true }
  }

  const membership = await db`
    select role from memberships
    where org_id = ${org.id}
      and user_id = ${opts.userId}
      and status = 'active'
  `
  const directRole = membership[0]?.role as OrgRole | undefined
  if (directRole && ROLE_RANK[directRole] >= needRank(opts.need)) {
    return { ok: true, org, role: directRole, canSpend: true }
  }

  // Inherited admin from parent super-org — never spend, never owner-only.
  if (org.parentId && opts.need !== 'spend' && opts.need !== 'owner') {
    const parent = await db`
      select m.role
      from memberships m
      join organizations o on o.id = m.org_id
      where m.org_id = ${org.parentId}
        and m.user_id = ${opts.userId}
        and m.status = 'active'
        and o.kind = 'super_org'
        and m.role in ('owner', 'admin')
    `
    const inherited = parent[0]?.role as OrgRole | undefined
    if (inherited && ROLE_RANK[inherited] >= needRank(opts.need)) {
      return { ok: true, org, role: 'inherited_admin', canSpend: false }
    }
  }

  return { ok: false, code: 'org_access_denied' }
}
