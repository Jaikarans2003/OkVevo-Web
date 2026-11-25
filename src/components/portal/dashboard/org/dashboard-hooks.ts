'use client'

/**
 * Org dashboard hooks: the URL account's org context (role/kind/canManage)
 * and a keyset-paged infinite variant of the shell's useAuthedQuery.
 */
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query'

import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { useOrgDetail, type OrgDetail } from '@/hooks/useAuthedQuery'
import { accountKey, useAccount } from '@/lib/orgs/accountContext'

export type OrgContext = {
  publicId: string
  role: string
  kind: 'org' | 'super_org'
  /** True only for the org's direct owner — mutations render behind this. */
  canManage: boolean
  /** Exact credit fields / owner-only billing reads. */
  canSeeExact: boolean
  detail: OrgDetail
}

/** Role/kind for the URL org. Pages render only after the layout gate passes. */
export function useOrgContext(): OrgContext | null {
  const account = useAccount()
  const publicId = account?.account === 'org' ? account.publicId : null
  const detail = useOrgDetail(publicId)
  if (!publicId || !detail.data) return null
  const role = detail.data.role
  return {
    publicId,
    role,
    kind: detail.data.org.kind,
    canManage: role === 'owner',
    canSeeExact: role === 'owner' || role === 'platform_admin',
    detail: detail.data,
  }
}

type Page = { items: unknown[]; nextCursor: string | null }

/**
 * Keyset-paged query for list endpoints (members, organisations, jobs,
 * activity, transfers, payments, transactions). Query key mirrors the shell:
 * [...base, accountKey], so ModulePage Refresh invalidates by base prefix.
 */
export function useOrgInfiniteQuery<T extends Page>(opts: {
  queryKey: readonly unknown[]
  /** Build the path for one page; cursor is null for the first page. */
  path: (cursor: string | null) => string
  enabled?: boolean
  refetchInterval?: number
}): UseInfiniteQueryResult<{ pages: T[]; pageParams: unknown[] }, Error> {
  const { user } = usePortalAuth()
  const account = useAccount()
  const org = account?.account === 'org' ? account.publicId : null
  return useInfiniteQuery<T, Error, { pages: T[]; pageParams: unknown[] }>({
    queryKey: [...opts.queryKey, accountKey(account)],
    enabled: !!user && (opts.enabled ?? true),
    initialPageParam: null,
    queryFn: ({ pageParam }) => authedJson<T>(user!, opts.path(pageParam as string | null), { org }),
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: opts.refetchInterval,
  })
}
