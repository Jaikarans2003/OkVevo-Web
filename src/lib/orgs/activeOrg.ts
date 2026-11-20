/**
 * Client active-account choice (plan §7.1). Empty / missing = Personal.
 */
export const ACTIVE_ORG_STORAGE_KEY = 'okvevo.activeOrgPublicId'

export type ActiveOrgChoice = {
  /** null = Personal (no X-OkVevo-Org header). */
  orgPublicId: string | null
}

export function readActiveOrgPublicId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function writeActiveOrgPublicId(orgPublicId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!orgPublicId) window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY)
    else window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgPublicId)
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Resolve stored choice against /api/me memberships.
 * If stored id is gone, or Personal while hidePersonal, fall back to upgraded org / Personal.
 */
export function resolveActiveOrg(opts: {
  stored: string | null
  hidePersonal: boolean
  upgradedOrgPublicId: string | null
  memberships: Array<{ orgPublicId: string }>
}): string | null {
  const ids = new Set(opts.memberships.map((m) => m.orgPublicId))
  if (opts.stored && ids.has(opts.stored)) return opts.stored
  if (opts.hidePersonal) return opts.upgradedOrgPublicId
  return null
}

export type CreateOrgUnder =
  | { show: true; parentPublicId: string; name: string }
  | { show: false }

/**
 * Profile “Create organisation under {name}” — active account (switcher, else
 * upgraded org) is a super_org and the caller is owner or admin.
 */
export function showCreateOrganisationUnder(opts: {
  activeOrgPublicId: string | null
  upgradedOrgPublicId: string | null
  memberships: Array<{
    orgPublicId: string
    kind: 'org' | 'super_org'
    role: 'owner' | 'admin' | 'member'
    name: string
  }>
}): CreateOrgUnder {
  const active = opts.activeOrgPublicId ?? opts.upgradedOrgPublicId
  if (!active) return { show: false }
  const m = opts.memberships.find((row) => row.orgPublicId === active)
  if (!m || m.kind !== 'super_org') return { show: false }
  if (m.role !== 'owner' && m.role !== 'admin') return { show: false }
  return { show: true, parentPublicId: m.orgPublicId, name: m.name }
}

/** Join-with-code is for individuals only (hidePersonal false). */
export function showJoinWithCode(hidePersonal: boolean): boolean {
  return !hidePersonal
}
