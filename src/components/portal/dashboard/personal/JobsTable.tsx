'use client'

/**
 * Jobs log (Usage › Jobs): shadcn Data Table over /api/billing/jobs with
 * model / job-type / status selects, cursor-paged "Load more", status
 * badges, and polling only while a loaded row is still in progress.
 * Model, job type and release-reason wording come straight from the API.
 */
import {
  columnVisibilityFeature,
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  fmtDateTime,
  fmtInt,
  IN_PROGRESS_STATUSES,
  JOB_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  jobStatusVariant,
  viewerTz,
} from './format'
import { useJobsQuery, useUsageQuery, type JobRow } from './queries'

const ALL = 'all'

/* Only column visibility is registered: rows render via row.getVisibleCells().
   Filtering/paging stay server-side, so no v9 row-model features are needed. */
const features = tableFeatures({ columnVisibilityFeature })
const columnHelper = createColumnHelper<typeof features, JobRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('createdAt', {
    header: 'Time',
    cell: (c) => fmtDateTime(c.getValue()),
  }),
  columnHelper.accessor('modelLabel', {
    header: 'Model',
    cell: (c) => c.getValue(),
  }),
  columnHelper.accessor('jobType', {
    header: 'Job type',
    cell: (c) => c.getValue(),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (c) => (
      <Badge variant={jobStatusVariant(c.getValue())} className="capitalize">
        {c.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor('credits', {
    header: 'Credits',
    cell: (c) => <span className="tabular-nums">{fmtInt(c.getValue())}</span>,
  }),
  columnHelper.accessor('releaseReason', {
    header: 'Release reason',
    cell: (c) => c.getValue() ?? '—',
  }),
])

export function useJobsExplore(keyPrefix: readonly unknown[], opts?: { enabled?: boolean }) {
  const [tz] = useState(viewerTz)
  const [model, setModel] = useState<string | null>(null)
  const [jobType, setJobType] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  // Poll only while a loaded job is still running (settle/release lands within seconds).
  const query = useJobsQuery(
    [...keyPrefix, 'rows', model ?? '', jobType ?? '', status ?? ''],
    { model, jobType, status },
    {
      ...opts,
      refetchInterval: (q) =>
        q.state.data?.pages.some((p) => p.items.some((j) => IN_PROGRESS_STATUSES.has(j.status)))
          ? 5_000
          : false,
    }
  )

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  const hasInProgress = items.some((j) => IN_PROGRESS_STATUSES.has(j.status))

  // Model options come from the usage view (same keys the jobs filter accepts).
  const options = useUsageQuery(
    [...keyPrefix, 'model-options', tz],
    { tz, bucket: 'day', groupBy: 'model', model: null, jobType: null },
    opts
  )
  const modelOptions = useMemo(() => {
    const labels = options.data?.labels ?? {}
    return Object.entries(labels)
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [options.data])

  return {
    query,
    items,
    hasInProgress,
    model,
    setModel,
    jobType,
    setJobType,
    status,
    setStatus,
    modelOptions,
  }
}

export type JobsExploreState = ReturnType<typeof useJobsExplore>

export default function JobsTable({ state }: { state: JobsExploreState }) {
  const { query, items } = state
  const table = useTable({ features, data: items, columns })

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="pt-field">
          <label htmlFor="jobs-model">Model</label>
          <Select
            value={state.model ?? ALL}
            onValueChange={(v) => state.setModel(v === ALL ? null : v)}
          >
            <SelectTrigger id="jobs-model" className="w-[220px]">
              <SelectValue placeholder="All models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All models</SelectItem>
              {state.modelOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="pt-field">
          <label htmlFor="jobs-job-type">Job type</label>
          <Select
            value={state.jobType ?? ALL}
            onValueChange={(v) => state.setJobType(v === ALL ? null : v)}
          >
            <SelectTrigger id="jobs-job-type" className="w-[160px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {JOB_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="pt-field">
          <label htmlFor="jobs-status">Status</label>
          <Select
            value={state.status ?? ALL}
            onValueChange={(v) => state.setStatus(v === ALL ? null : v)}
          >
            <SelectTrigger id="jobs-status" className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {JOB_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state.hasInProgress ? (
          <p className="pt-fine ml-auto" aria-live="polite">
            Refreshing while jobs run…
          </p>
        ) : null}
      </div>

      {query.isPending ? (
        <div className="grid gap-3" role="status" aria-busy="true" aria-label="Loading jobs">
          <Skeleton className="h-10 rounded-[var(--r)]" />
          <Skeleton className="h-64 rounded-[var(--r)]" />
        </div>
      ) : query.isError ? (
        <p className="pt-note pt-note--bad" role="alert">
          Couldn’t load jobs. {query.error.message}
        </p>
      ) : items.length === 0 ? (
        <div className="pt-empty rounded-xl border bg-card shadow">
          <p className="text-lg font-semibold">No jobs yet</p>
          <p className="pt-fine">Jobs appear here as the desktop app runs them.</p>
          <a className="btn btn--go" href="/okvevo-download">
            Download the desktop app
          </a>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {query.hasNextPage ? (
            <div className="border-t p-3">
              <button
                type="button"
                className="btn"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
