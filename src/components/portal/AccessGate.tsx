'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import type { ReactNode } from 'react'

import NoAccess from '@/components/portal/NoAccess'

/**
 * Role gate for account subtrees (plan §9): a direct URL to a page the role
 * can't use renders NoAccess instead of the page. `allowed` comes from the
 * account's menu (allowedSegments), so nav and access can never drift apart.
 */
export default function AccessGate({
  allowed,
  children,
}: {
  allowed: ReadonlySet<string>
  children: ReactNode
}) {
  const segment = useSelectedLayoutSegment() ?? ''
  if (!allowed.has(segment)) return <NoAccess />
  return <>{children}</>
}
