'use client'

/**
 * Jobs log (Usage › Jobs): keyset-paged table of gateway jobs with date,
 * member (owners), model, job-type and status filters + CSV export.
 * Rows come pre-whitelisted from the API (display names, no provider/payload).
 */
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthedQuery } from '@/hooks/useAuthedQuery'
import { usePortalAuth } from '@/components/portal/PortalAuth'

import { useOrgInfiniteQuery } from './dashboard-hooks'
import type { JobRow, MemberRow, Paged, UsageResult } from './dashboard-types'
import {
  DATE_PRESETS,
  downloadCsv,
  errorText,
  fmtDateTime,
  fmtInt,
  rangeForPreset,
  VIEWER_TZ,
  type DatePreset,
} from './dashboard-utils'
import { EmptyState, ErrorNote } from './dashboard-parts'

const JOB_TYPES = ['Chat', 'Search', 'Image', 'Video', 'Audio'] as const
const JOB_STATUSES = ['reserved', 'queued', 'dispatching', 'submitted', 'settled', 'released'] as const

type JobFilters = {
  from: Date | null
  to: Date | null
  member: string | null
  model: string | null
  jobType: string | null
  status: string | null
}

function jobsPath(publicId: string, f: JobFilters, cursor: string | null, csv = false): string {
  const p = new URLSearchParams()
  if (f.from) p.set('from', f.from.toISOString())
  if (f.to) p.set('to', f.to.toISOString())
  if (f.member) p.set('member', f.member)
  if (f.model) p.set('model', f.model)
  if (f.jobType) p.set('job_type', f.jobType.toLowerCase())
  if (f.status) p.set('status', f.status)
  if (cursor) p.set('cursor', cursor)
  if (csv) p.set('format', 'csv')
  return `/api/orgs/${publicId}/jobs?${p}`
}

export default function JobsLog({
  publicId,
  variant,
  members,
}: {
  publicId: string
  variant: 'owner' | 'member' | 'super'
  members?: MemberRow[]
}) {
  const { user } = usePortalAuth()
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [member, setMember] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [jobType, setJobType] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  const range =
    preset === 'custom'
      ? customFrom && customTo
        ? { from: customFrom, to: customTo }
        : null
      : rangeForPreset(preset)

  /* Jobs take instants; convert the local-day range in the viewer's tz.
   * `to` is exclusive on the server → next local midnight. */
  const filters: JobFilters | null = range
    ? {
        from: new Date(`${range.from}T00:00:00`),
        to: new Date(new Date(`${range.to}T00:00:00`).getTime() + 864e5),
        member,
        model,
        jobType,
        status,
      }
    : null

  const jobs = useOrgInfiniteQuery<Paged<JobRow>>({
    queryKey: ['jobs', filters],
    path: (cursor) => (filters ? jobsPath(publicId, filters, cursor) : ''),
    enabled: !!filters,
    refetchInterval: 60_000,
  })

  /* Model options harvested from this wallet's usage (same raw keys). */
  const modelOptionsQuery = useAuthedQuery<UsageResult>({
    queryKey: ['usage', 'model-options'],
    path: `/api/orgs/${publicId}/usage?${new URLSearchParams({ tz: VIEWER_TZ, bucket: 'day', group_by: 'model' })}`,
  })
  const [modelOptions, setModelOptions] = useState<Record<string, string>>({})
  useEffect(() => {
    if (modelOptionsQuery.data && Object.keys(modelOptionsQuery.data.labels).length > 0) {
      setModelOptions((prev) => ({ ...prev, ...modelOptionsQuery.data.labels }))
    }
  }, [modelOptionsQuery.data])

  const nameOf = (uid: string): string => {
    const m = members?.find((row) => row.userId === uid)
    return m?.name ?? m?.email ?? uid
  }

  const rows = jobs.data?.pages.flatMap((p) => p.items) ?? []

  if (!filters) {
    return <p className="text-sm text-muted-foreground">Pick both dates for the custom range.</p>
  }
  if (jobs.isError) return <ErrorNote error={jobs.error} />

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Jobs filters">
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground" id="jl-range-label">
            Range
          </span>
          <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
            <SelectTrigger className="w-[150px]" aria-labelledby="jl-range-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {preset === 'custom' ? (
          <>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="jl-from">
                From
              </label>
              <Input id="jl-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="jl-to">
                To
              </label>
              <Input id="jl-to" type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className="w-[150px]" />
            </div>
          </>
        ) : null}
        {variant === 'owner' && members ? (
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground" id="jl-member-label">
              Member
            </span>
            <Select value={member ?? 'all'} onValueChange={(v) => setMember(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[180px]" aria-labelledby="jl-member-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name ?? m.email ?? m.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {Object.keys(modelOptions).length > 0 ? (
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground" id="jl-model-label">
              Model
            </span>
            <Select value={model ?? 'all'} onValueChange={(v) => setModel(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[180px]" aria-labelledby="jl-model-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {Object.entries(modelOptions).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground" id="jl-jt-label">
            Job type
          </span>
          <Select value={jobType ?? 'all'} onValueChange={(v) => setJobType(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[130px]" aria-labelledby="jl-jt-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {JOB_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground" id="jl-status-label">
            Status
          </span>
          <Select value={status ?? 'all'} onValueChange={(v) => setStatus(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[140px]" aria-labelledby="jl-status-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent"
          onClick={() => {
            setCsvError(null)
            downloadCsv(user!, jobsPath(publicId, filters, null, true), null, 'jobs.csv').catch((e) =>
              setCsvError(errorText(e instanceof Error ? e.message : 'request_failed'))
            )
          }}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </button>
      </div>
      {csvError ? <ErrorNote error={csvError} /> : null}

      {jobs.isPending ? (
        <div className="h-72 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Loading jobs" />
      ) : rows.length === 0 ? (
        <EmptyState title="No jobs in this range" hint="Try a wider date range." />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Job type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Release reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(job.createdAt)}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{nameOf(job.memberUserId)}</TableCell>
                    <TableCell>{job.modelLabel}</TableCell>
                    <TableCell>{job.jobType}</TableCell>
                    <TableCell>{job.status}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(job.credits)}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{job.releaseReason ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {jobs.hasNextPage ? (
            <div>
              <Button variant="outline" onClick={() => jobs.fetchNextPage()} disabled={jobs.isFetchingNextPage}>
                {jobs.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
