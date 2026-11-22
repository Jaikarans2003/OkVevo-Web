/**
 * Dashboard display helpers for PR 2b-c.
 * All debt / overdrawn math reuses 2b-a overdrawn.ts — no second calculation.
 */
import {
  overdrawnCredits,
  overdrawnPct,
  overdrawnSentence,
} from '@/lib/orgs/overdrawn'

export { overdrawnCredits, overdrawnPct, overdrawnSentence }

/** Owes column % — same as overdrawnPct. */
export function owesPct(sponsoredBalance: number, creditLimit: number): number {
  return overdrawnPct(sponsoredBalance, creditLimit)
}

/** Owes column credits — absolute overdrawn amount. */
export function owesCredits(sponsoredBalance: number): number {
  return overdrawnCredits(sponsoredBalance)
}

/** Sum of child overdrawn credit amounts (not a sum of percents). */
export function owedByOrganisationsTotal(
  childSponsoredBalances: readonly number[]
): number {
  let sum = 0
  for (const bal of childSponsoredBalances) {
    sum += overdrawnCredits(bal)
  }
  return sum
}

/** Split one transfer into repaid debt vs newly added sponsored credits. */
export function transferRepayAddedSplit(opts: {
  transferred: number
  debtRecovered: number
}): { repaid: number; added: number } {
  const repaid = Math.max(0, Math.min(opts.debtRecovered, opts.transferred))
  return { repaid, added: Math.max(0, opts.transferred - repaid) }
}

export function availableToSendLabel(credits: number): string {
  return `Available to send: ${credits} credits`
}

export function receivedFromSuperOrgLabel(opts: {
  total: number
  superOrgName: string
  repaid: number
  added: number
}): string {
  const base = `Received ${opts.total} credits from ${opts.superOrgName}`
  if (opts.repaid <= 0 && opts.added <= 0) return base
  return `${base} (${opts.repaid} repaid, ${opts.added} added)`
}

export type DashboardNavKind = 'dashboard' | 'my_usage' | 'none'

/**
 * Portal nav label for the active org/super-org.
 * Owners/admins → Dashboard; members → My usage; no org context → none.
 */
export function dashboardNavForRole(
  role: string | null | undefined
): DashboardNavKind {
  if (!role) return 'none'
  if (
    role === 'owner' ||
    role === 'admin' ||
    role === 'inherited_admin' ||
    role === 'platform_admin'
  ) {
    return 'dashboard'
  }
  if (role === 'member') return 'my_usage'
  return 'none'
}

export function dashboardNavLabel(kind: DashboardNavKind): string | null {
  if (kind === 'dashboard') return 'Dashboard'
  if (kind === 'my_usage') return 'My usage'
  return null
}

/** Owner (or platform admin) may change roles / invite owner|admin / remove admin|owner. */
export function isOwnerCapableRole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'platform_admin'
}

export function canChangeMemberRoles(role: string | null | undefined): boolean {
  return isOwnerCapableRole(role)
}

export function canInvitePrivilegedRoles(role: string | null | undefined): boolean {
  return isOwnerCapableRole(role)
}

export function canRemovePrivilegedMembers(role: string | null | undefined): boolean {
  return isOwnerCapableRole(role)
}
