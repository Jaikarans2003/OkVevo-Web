'use client'

/**
 * TanStack Query wiring for the dashboard shell (plan §5). One cache, keys
 * scoped by account. `useAuthedQuery` injects the URL account (from
 * AccountProvider) into BOTH the fetch's X-OkVevo-Org header and the query
 * key, so a key can never point at the wrong account's data.
 *
 * Later module waves: build keys with `queryKeys` and fetch with
 * `useAuthedQuery` (pass options.refetchInterval for polling pages).
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'

import { authedJson } from '@/lib/api/browser'
import type { BillingSummary } from '@/lib/api/billingSummary'
import type { MePayload } from '@/lib/api/me'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { accountKey, useAccount, type AccountRef } from '@/lib/orgs/accountContext'

/** Org detail as the shell needs it (GET /api/orgs/:publicId). */
export type OrgDetail = {
  org: {
    publicId: string
    name: string
    kind: 'org' | 'super_org'
    parentId: string | null
    parentName: string | null
  }
  /** owner | member | inherited_read | platform_admin */
  role: string
  canSpend: boolean
} & Record<string, unknown>

export const queryKeys = {
  me: ['me'] as const,
  org: (publicId: string) => ['org', publicId] as const,
  summary: (account: AccountRef | null) => ['summary', accountKey(account)] as const,
  /** Module base keys (later waves fill the queries; invalidate with these). */
  usage: (account: AccountRef | null) => ['usage', accountKey(account)] as const,
  members: (account: AccountRef | null) => ['members', accountKey(account)] as const,
  organisations: (account: AccountRef | null) => ['organisations', accountKey(account)] as const,
  credits: (account: AccountRef | null) => ['credits', accountKey(account)] as const,
  jobs: (account: AccountRef | null) => ['jobs', accountKey(account)] as const,
}

type AuthedQueryOpts<T> = {
  /** Base key; the account fragment is appended automatically. */
  queryKey: readonly unknown[]
  path: string
  enabled?: boolean
  options?: Partial<Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn' | 'enabled'>>
}

export function useAuthedQuery<T>(opts: AuthedQueryOpts<T>): UseQueryResult<T, Error> {
  const { user } = usePortalAuth()
  const account = useAccount()
  const org = account?.account === 'org' ? account.publicId : null
  return useQuery<T, Error>({
    queryKey: [...opts.queryKey, accountKey(account)],
    enabled: !!user && (opts.enabled ?? true),
    queryFn: () => authedJson<T>(user!, opts.path, { org }),
    ...opts.options,
  })
}

/** /api/me — account-less (no org header). Safe above AccountProvider. */
export function useMe(): UseQueryResult<MePayload, Error> {
  const { user } = usePortalAuth()
  return useQuery<MePayload, Error>({
    queryKey: queryKeys.me,
    enabled: !!user,
    queryFn: () => authedJson<MePayload>(user!, '/api/me', { org: null }),
  })
}

/**
 * /api/orgs/:publicId — the org access gate: 403/404 lands here as an error
 * and the org layout renders NoAccess. No retries so NoAccess shows fast.
 */
export function useOrgDetail(publicId: string | null): UseQueryResult<OrgDetail, Error> {
  const { user } = usePortalAuth()
  return useQuery<OrgDetail, Error>({
    queryKey: queryKeys.org(publicId ?? 'none'),
    enabled: !!user && !!publicId,
    retry: false,
    queryFn: () => authedJson<OrgDetail>(user!, `/api/orgs/${publicId}`, { org: publicId }),
  })
}

/** /api/billing/summary for the URL account (percentages only). */
export function useSummary(): UseQueryResult<BillingSummary, Error> {
  return useAuthedQuery<BillingSummary>({ queryKey: ['summary'], path: '/api/billing/summary' })
}
