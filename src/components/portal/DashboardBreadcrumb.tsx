'use client'

/**
 * Content-header breadcrumb (plan §7), wired to the route segments. Labels
 * come from the route-meta table (segmentLabel); the account crumb is the
 * account name. Later waves' nested pages (child orgs, jobs) slot in as
 * extra segments automatically.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { segmentLabel } from '@/components/portal/nav'
import { accountBasePath, type AccountRef } from '@/lib/orgs/accountContext'

export default function DashboardBreadcrumb({
  account,
  accountName,
}: {
  account: AccountRef | null
  accountName: string | null
}) {
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/').filter(Boolean) // ['dashboard', ...rest]
  const rest = segments.slice(1)

  type Crumb = { label: string; href: string | null }
  let crumbs: Crumb[]

  if (account) {
    const base = accountBasePath(account)
    const afterAccount = account.account === 'personal' ? rest.slice(1) : rest.slice(2)
    const rootLabel =
      account.account === 'personal' ? 'Personal' : (accountName ?? 'Organisation')
    crumbs = [{ label: rootLabel, href: base }]
    afterAccount.forEach((seg, i) => {
      const isLast = i === afterAccount.length - 1
      crumbs.push({
        label: segmentLabel(seg),
        href: isLast ? null : `${base}/${afterAccount.slice(0, i + 1).join('/')}`,
      })
    })
    if (crumbs.length === 1) crumbs[0] = { ...crumbs[0], href: null }
  } else {
    // Account-less dashboard pages (profile, redirects).
    const page = rest[0]
    crumbs = [{ label: page ? segmentLabel(page) : 'Dashboard', href: null }]
  }

  return (
    <Breadcrumb aria-label="Breadcrumb">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <Fragment key={`${crumb.label}-${i}`}>
            {i > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
