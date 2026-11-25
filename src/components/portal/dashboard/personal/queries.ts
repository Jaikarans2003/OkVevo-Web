'use client'

/**
 * Account-scoped queries for the personal dashboard modules. Mirrors
 * useAuthedQuery (same user + X-OkVevo-Org from the URL account) and adds an
 * infinite variant for cursor-paged endpoints. Keys are built by the caller
 * from queryKeys bases so a module Refresh prefix-matches every child.
 */
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type Query,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { authedJson } from '@/lib/api/browser'
import type { BillingSummary } from '@/lib/api/billingSummary'
import type { LedgerPage } from '@/lib/api/billingTransactions'
import type { CreditsHealth } from '@/lib/analytics/billingCredits'
import type { JobRow } from '@/lib/analytics/jobs'
import type { PaymentsPage } from '@/lib/analytics/payments'
import type { UsageBucket, UsageGroupBy, UsageResult } from '@/lib/analytics/usage'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { useAccount } from '@/lib/orgs/accountContext'

export type { CreditsHealth, JobRow, LedgerPage, PaymentsPage, UsageResult }

function useAccountFetch() {
  const { user } = usePortalAuth()
  const account = useAccount()
  const org = account?.account === 'org' ? account.publicId : null
  return { user, org }
}

function qs(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') search.set(k, v)
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

/** /api/billing/summary keyed by the caller (module-scoped, unlike useSummary). */
export function useSummaryQuery(
  queryKey: readonly unknown[],
  opts?: { enabled?: boolean; refetchInterval?: number }
): UseQueryResult<BillingSummary, Error> {
  const { user, org } = useAccountFetch()
  return useQuery<BillingSummary, Error>({
    queryKey,
    enabled: !!user && (opts?.enabled ?? true),
    refetchInterval: opts?.refetchInterval,
    refetchIntervalInBackground: false,
    queryFn: () => authedJson<BillingSummary>(user!, '/api/billing/summary', { org }),
  })
}

export type UsageQueryParams = {
  tz: string
  bucket: UsageBucket
  groupBy: UsageGroupBy
  model: string | null
  jobType: string | null
}

export function usagePath(p: UsageQueryParams, format?: 'csv'): string {
  return `/api/billing/usage${qs({
    tz: p.tz,
    bucket: p.bucket,
    group_by: p.groupBy,
    model: p.model,
    job_type: p.jobType,
    format: format ?? null,
  })}`
}

export function useUsageQuery(
  queryKey: readonly unknown[],
  params: UsageQueryParams,
  opts?: { enabled?: boolean; refetchInterval?: number }
): UseQueryResult<UsageResult, Error> {
  const { user, org } = useAccountFetch()
  return useQuery<UsageResult, Error>({
    queryKey,
    enabled: !!user && (opts?.enabled ?? true),
    refetchInterval: opts?.refetchInterval,
    refetchIntervalInBackground: false,
    queryFn: () => authedJson<UsageResult>(user!, usagePath(params), { org }),
  })
}

export type JobsParams = {
  model: string | null
  jobType: string | null
  status: string | null
}

function jobsPath(p: JobsParams, cursor: string | null): string {
  return `/api/billing/jobs${qs({
    model: p.model,
    job_type: p.jobType,
    status: p.status,
    limit: '50',
    cursor,
  })}`
}

type JobsPage = { items: JobRow[]; nextCursor: string | null }
type JobsData = InfiniteData<JobsPage, string | null>

/** Static interval, off, or derived from the loaded pages (poll only while jobs run). */
export type JobsRefetchInterval =
  | number
  | false
  | ((query: Query<JobsPage, Error, JobsData, readonly unknown[]>) => number | false | undefined)

export function useJobsQuery(
  queryKey: readonly unknown[],
  params: JobsParams,
  opts?: { enabled?: boolean; refetchInterval?: JobsRefetchInterval }
): UseInfiniteQueryResult<JobsData, Error> {
  const { user, org } = useAccountFetch()
  return useInfiniteQuery<JobsPage, Error, JobsData, readonly unknown[], string | null>({
    queryKey,
    enabled: !!user && (opts?.enabled ?? true),
    initialPageParam: null,
    queryFn: ({ pageParam }) => authedJson<JobsPage>(user!, jobsPath(params, pageParam), { org }),
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: opts?.refetchInterval,
    refetchIntervalInBackground: false,
  })
}

export function useTransactionsQuery(
  queryKey: readonly unknown[],
  opts?: { enabled?: boolean }
): UseInfiniteQueryResult<InfiniteData<LedgerPage, string | null>, Error> {
  const { user, org } = useAccountFetch()
  return useInfiniteQuery<
    LedgerPage,
    Error,
    InfiniteData<LedgerPage, string | null>,
    readonly unknown[],
    string | null
  >({
    queryKey,
    enabled: !!user && (opts?.enabled ?? true),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      authedJson<LedgerPage>(user!, `/api/billing/transactions${qs({ cursor: pageParam })}`, {
        org,
      }),
    getNextPageParam: (last) => last.nextCursor,
    refetchIntervalInBackground: false,
  })
}

export function useCreditsQuery(
  queryKey: readonly unknown[],
  opts?: { enabled?: boolean }
): UseQueryResult<CreditsHealth, Error> {
  const { user, org } = useAccountFetch()
  return useQuery<CreditsHealth, Error>({
    queryKey,
    enabled: !!user && (opts?.enabled ?? true),
    queryFn: () => authedJson<CreditsHealth>(user!, '/api/billing/credits', { org }),
  })
}

export function usePaymentsQuery(
  queryKey: readonly unknown[],
  opts?: { enabled?: boolean }
): UseInfiniteQueryResult<InfiniteData<PaymentsPage, string | null>, Error> {
  const { user, org } = useAccountFetch()
  return useInfiniteQuery<
    PaymentsPage,
    Error,
    InfiniteData<PaymentsPage, string | null>,
    readonly unknown[],
    string | null
  >({
    queryKey,
    enabled: !!user && (opts?.enabled ?? true),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      authedJson<PaymentsPage>(user!, `/api/billing/payments${qs({ cursor: pageParam })}`, {
        org,
      }),
    getNextPageParam: (last) => last.nextCursor,
    refetchIntervalInBackground: false,
  })
}
