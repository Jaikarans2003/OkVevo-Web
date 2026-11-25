/**
 * Role-filtered sidebar menus + route meta for the URL-scoped dashboard
 * (plan §7). Every tab is a nested route; Profile is the one external tab
 * (real page at /dashboard/profile, linked from the sidebar footer too).
 */
import {
  Activity,
  Building2,
  Coins,
  CreditCard,
  Crown,
  LayoutDashboard,
  Settings,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { accountBasePath, type AccountRef } from '@/lib/orgs/accountContext'

export type ShellNavItem = {
  name: string
  /** Route segment under the account base; '' = account root (Overview). */
  segment: string
  icon: LucideIcon
  /** Set only for tabs that live outside the account subtree (Profile). */
  externalHref?: string
}

const PROFILE_ITEM: ShellNavItem = {
  name: 'Profile',
  segment: 'profile',
  icon: User,
  externalHref: '/dashboard/profile',
}

const OVERVIEW_ITEM: ShellNavItem = { name: 'Overview', segment: '', icon: LayoutDashboard }
const USAGE_ITEM: ShellNavItem = { name: 'Usage', segment: 'usage', icon: Activity }
const BILLING_ITEM: ShellNavItem = { name: 'Billing', segment: 'billing', icon: CreditCard }

const PERSONAL_MENU: ShellNavItem[] = [
  OVERVIEW_ITEM,
  USAGE_ITEM,
  BILLING_ITEM,
  { name: 'Organisations', segment: 'organisations', icon: Building2 },
  { name: 'Account type', segment: 'account-type', icon: Crown },
  PROFILE_ITEM,
]

const ORG_OWNER_MENU: ShellNavItem[] = [
  OVERVIEW_ITEM,
  { name: 'Members', segment: 'members', icon: Users },
  USAGE_ITEM,
  BILLING_ITEM,
  { name: 'Settings', segment: 'settings', icon: Settings },
  PROFILE_ITEM,
]

const ORG_MEMBER_MENU: ShellNavItem[] = [
  OVERVIEW_ITEM,
  { name: 'My usage', segment: 'my-usage', icon: Activity },
  { name: 'Organisation', segment: 'organisation', icon: Building2 },
  PROFILE_ITEM,
]

const SUPER_ORG_OWNER_MENU: ShellNavItem[] = [
  OVERVIEW_ITEM,
  { name: 'Organisations', segment: 'organisations', icon: Building2 },
  { name: 'Credits', segment: 'credits', icon: Coins },
  USAGE_ITEM,
  BILLING_ITEM,
  { name: 'Settings', segment: 'settings', icon: Settings },
  PROFILE_ITEM,
]

/** Menu for the active account; role/kind from /api/me membership or org detail. */
export function dashboardMenu(opts: {
  account: AccountRef
  role: string | null
  kind: 'org' | 'super_org' | null
}): ShellNavItem[] {
  if (opts.account.account === 'personal') return PERSONAL_MENU
  if (opts.role === 'member') return ORG_MEMBER_MENU
  if (opts.kind === 'super_org') return SUPER_ORG_OWNER_MENU
  return ORG_OWNER_MENU
}

/** Segments the role may open directly (AccessGate). External tabs excluded. */
export function allowedSegments(menu: ShellNavItem[]): ReadonlySet<string> {
  return new Set(menu.filter((i) => !i.externalHref).map((i) => i.segment))
}

export function navItemHref(account: AccountRef, item: ShellNavItem): string {
  if (item.externalHref) return item.externalHref
  const base = accountBasePath(account)
  return item.segment ? `${base}/${item.segment}` : base
}

/** Breadcrumb labels per route segment; unknown segments humanize. */
export const SEGMENT_LABELS: Record<string, string> = {
  personal: 'Personal',
  usage: 'Usage',
  billing: 'Billing',
  organisations: 'Organisations',
  'account-type': 'Account type',
  members: 'Members',
  'my-usage': 'My usage',
  organisation: 'Organisation',
  credits: 'Credits',
  settings: 'Settings',
  profile: 'Profile',
  jobs: 'Jobs',
}

export function segmentLabel(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
