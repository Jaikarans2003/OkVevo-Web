'use client'

/**
 * Account switcher (plan §4): a dropdown of plain next/links — Personal
 * (unless hidePersonal) plus every membership. Switching is navigation, not
 * reload; the destination account layout records it as last-used.
 */
import { Check, ChevronsUpDown } from 'lucide-react'
import Link from 'next/link'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { MePayload } from '@/lib/api/me'
import { accountBasePath, type AccountRef } from '@/lib/orgs/accountContext'

export default function AccountSwitcher({
  me,
  account,
}: {
  me: MePayload
  account: AccountRef | null
}) {
  const currentLabel =
    account?.account === 'org'
      ? (me.memberships.find((m) => m.orgPublicId === account.publicId)?.name ?? 'Organisation')
      : 'Personal'

  const items: Array<{ key: string; name: string; href: string; current: boolean }> = []
  if (!me.hidePersonal) {
    items.push({
      key: 'personal',
      name: 'Personal',
      href: accountBasePath({ account: 'personal' }),
      current: account?.account !== 'org',
    })
  }
  for (const m of me.memberships) {
    items.push({
      key: m.orgPublicId,
      name: m.name,
      href: accountBasePath({ account: 'org', publicId: m.orgPublicId }),
      current: account?.account === 'org' && account.publicId === m.orgPublicId,
    })
  }

  if (items.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="pt-input dashboard-switcher" aria-label="Switch account">
          <span className="truncate">{currentLabel}</span>
          <ChevronsUpDown size={15} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Use credits from</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.key} asChild>
            <Link href={item.href} aria-current={item.current ? 'page' : undefined}>
              <span className="flex-1 truncate">{item.name}</span>
              {item.current ? <Check size={15} aria-hidden /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
