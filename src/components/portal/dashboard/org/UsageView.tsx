'use client'

/**
 * Usage view (plan §2 "Usage view", scoped by role):
 *  - owner  : model + job-type stacked charts, requests line, top members,
 *             member/model/job-type filters, CSV.
 *  - member : same charts for their own rows (server forces user_id = me).
 *  - super  : aggregate incl. children (group_by=org), stacked by org,
 *             top 10 orgs + per-child table, CSV.
 * One filters row drives every chart and the CSV. "Times in {tz}" caption.
 */
import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthedQuery } from '@/hooks/useAuthedQuery'
import { usePortalAuth } from '@/components/portal/PortalAuth'

import type { MemberRow, UsageResult } from './dashboard-types'
import {
  DATE_PRESETS,
  downloadCsv,
  errorText,
  fmtInt,
  localDay,
  rangeForPreset,
  VIEWER_TZ,
  type DatePreset,
} from './dashboard-utils'
import { CHART_COLORS, ChartCard, DeltaLabel, EmptyState, ErrorNote, KpiCard, KpiGrid } from './dashboard-parts'

const JOB_TYPES = ['Chat', 'Search', 'Image', 'Video', 'Audio'] as const

type Filters = {
  from: string
  to: string
  bucket: 'day' | 'week' | 'month'
  member: string | null
  model: string | null
  jobType: string | null
}

function usagePath(publicId: string, f: Filters, groupBy: string, csv = false): string {
  const p = new URLSearchParams({ from: f.from, to: f.to, tz: VIEWER_TZ, bucket: f.bucket, group_by: groupBy })
  if (f.member) p.set('member', f.member)
  if (f.model) p.set('model', f.model)
  if (f.jobType) p.set('job_type', f.jobType.toLowerCase())
  if (csv) p.set('format', 'csv')
  return `/api/orgs/${publicId}/usage?${p}`
}

/** Pivot series rows into per-bucket stacks: top 5 labels + Other. */
function pivot(result: UsageResult): { rows: Record<string, number | string>[]; stacks: { id: string; label: string }[] } {
  const totals = new Map<string, number>()
  for (const s of result.series) {
    const label = result.labels[s.key] ?? s.key
    totals.set(label, (totals.get(label) ?? 0) + s.credits)
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5)
  const stacks = top.map(([label], i) => ({ id: `s${i}`, label }))
  const stackOf = new Map(top.map(([label], i) => [label, `s${i}`]))
  const byBucket = new Map<string, Record<string, number | string>>()
  for (const s of result.series) {
    const label = result.labels[s.key] ?? s.key
    const id = stackOf.get(label) ?? 'other'
    const row = byBucket.get(s.bucket) ?? { bucket: s.bucket }
    row[id] = (Number(row[id]) || 0) + s.credits
    byBucket.set(s.bucket, row)
  }
  if ([...byBucket.values()].some((r) => Number(r.other) > 0) || totals.size > 5) {
    stacks.push({ id: 'other', label: 'Other' })
  }
  return { rows: [...byBucket.values()], stacks }
}

function perBucketTotals(result: UsageResult): { bucket: string; credits: number; requests: number }[] {
  const map = new Map<string, { bucket: string; credits: number; requests: number }>()
  for (const s of result.series) {
    const row = map.get(s.bucket) ?? { bucket: s.bucket, credits: 0, requests: 0 }
    row.credits += s.credits
    row.requests += s.requests
    map.set(s.bucket, row)
  }
  return [...map.values()]
}

function chartConfigFor(stacks: { id: string; label: string }[]): ChartConfig {
  const config: ChartConfig = {}
  stacks.forEach((s, i) => {
    config[s.id] = { label: s.label, color: CHART_COLORS[i % CHART_COLORS.length] }
  })
  return config
}

const tickDay = (v: string) => (v.length === 10 ? v.slice(5) : v)

export default function UsageView({
  publicId,
  variant,
  members,
}: {
  publicId: string
  variant: 'owner' | 'member' | 'super'
  /** Member filter options + uid → name map (owner variant). */
  members?: MemberRow[]
}) {
  const { user } = usePortalAuth()
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [bucket, setBucket] = useState<Filters['bucket']>('day')
  const [member, setMember] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [jobType, setJobType] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  const range =
    preset === 'custom'
      ? customFrom && customTo
        ? { from: customFrom, to: customTo }
        : null
      : rangeForPreset(preset)

  const filters: Filters | null = range
    ? { from: range.from, to: range.to, bucket, member, model, jobType }
    : null

  /* Main queries. super = one group_by=org query (the only scope that
   * includes children); owner/member = model + job-type queries. */
  const groupA = variant === 'super' ? 'org' : 'model'
  const main = useAuthedQuery<UsageResult>({
    queryKey: ['usage', groupA, filters],
    path: filters ? usagePath(publicId, filters, groupA) : '',
    enabled: !!filters,
  })
  const byJobType = useAuthedQuery<UsageResult>({
    queryKey: ['usage', 'job_type', filters],
    path: filters ? usagePath(publicId, filters, 'job_type') : '',
    enabled: !!filters && variant !== 'super',
  })
  const topList = useAuthedQuery<UsageResult>({
    queryKey: ['usage', 'top', filters],
    path: filters ? usagePath(publicId, filters, variant === 'super' ? 'org' : 'member') : '',
    enabled: !!filters && variant === 'owner',
  })

  /* Model filter options harvested from unfiltered model-grouped results. */
  const [modelOptions, setModelOptions] = useState<Record<string, string>>({})
  useEffect(() => {
    if (variant === 'super' || model || !main.data) return
    if (Object.keys(main.data.labels).length > 0) {
      setModelOptions((prev) => ({ ...prev, ...main.data.labels }))
    }
  }, [main.data, model, variant])

  const pivotA = useMemo(() => (main.data ? pivot(main.data) : null), [main.data])
  const pivotB = useMemo(() => (byJobType.data ? pivot(byJobType.data) : null), [byJobType.data])
  const bucketTotals = useMemo(() => (main.data ? perBucketTotals(main.data) : []), [main.data])
  const jobTypeTotals = useMemo(() => {
    if (!byJobType.data) return []
    const map = new Map<string, { label: string; credits: number; requests: number }>()
    for (const s of byJobType.data.series) {
      const label = byJobType.data.labels[s.key] ?? s.key
      const row = map.get(label) ?? { label, credits: 0, requests: 0 }
      row.credits += s.credits
      row.requests += s.requests
      map.set(label, row)
    }
    return [...map.values()].sort((a, b) => b.credits - a.credits)
  }, [byJobType.data])

  if (!filters) {
    return <p className="text-sm text-muted-foreground">Pick both dates for the custom range.</p>
  }
  if (main.isError) return <ErrorNote error={main.error} />

  const empty = main.data && main.data.series.length === 0
  const activeMembers = variant === 'owner' ? topList.data?.totals.activeMembers : undefined

  return (
    <div className="grid gap-6">
      {/* Filters drive every chart, table and the CSV below. */}
      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Usage filters">
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground" id="uv-range-label">
            Range
          </span>
          <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
            <SelectTrigger className="w-[150px]" aria-labelledby="uv-range-label">
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
              <label className="text-xs font-medium text-muted-foreground" htmlFor="uv-from">
                From
              </label>
              <Input id="uv-from" type="date" value={customFrom} max={customTo || localDay(new Date())}
                onChange={(e) => setCustomFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="uv-to">
                To
              </label>
              <Input id="uv-to" type="date" value={customTo} min={customFrom} max={localDay(new Date())}
                onChange={(e) => setCustomTo(e.target.value)} className="w-[150px]" />
            </div>
          </>
        ) : null}
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground" id="uv-bucket-label">
            Group by
          </span>
          <Select value={bucket} onValueChange={(v) => setBucket(v as Filters['bucket'])}>
            <SelectTrigger className="w-[110px]" aria-labelledby="uv-bucket-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {variant === 'owner' && members ? (
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground" id="uv-member-label">
              Member
            </span>
            <Select value={member ?? 'all'} onValueChange={(v) => setMember(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[190px]" aria-labelledby="uv-member-label">
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
        {variant !== 'super' && Object.keys(modelOptions).length > 0 ? (
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground" id="uv-model-label">
              Model
            </span>
            <Select value={model ?? 'all'} onValueChange={(v) => setModel(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[190px]" aria-labelledby="uv-model-label">
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
          <span className="text-xs font-medium text-muted-foreground" id="uv-jt-label">
            Job type
          </span>
          <Select value={jobType ?? 'all'} onValueChange={(v) => setJobType(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[130px]" aria-labelledby="uv-jt-label">
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
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent"
          onClick={() => {
            setCsvError(null)
            downloadCsv(user!, usagePath(publicId, filters, groupA, true), null, 'usage.csv').catch((e) =>
              setCsvError(errorText(e instanceof Error ? e.message : 'request_failed'))
            )
          }}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </button>
      </div>
      {csvError ? <ErrorNote error={csvError} /> : null}

      {main.isPending ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading usage">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : null}

      {main.data ? (
        <>
          <KpiGrid>
            <KpiCard
              label="Credits used"
              value={fmtInt(main.data.totals.credits)}
              sub={<DeltaLabel current={main.data.totals.credits} previous={main.data.previous.credits} />}
            />
            <KpiCard
              label="Requests"
              value={fmtInt(main.data.totals.requests)}
              sub={<DeltaLabel current={main.data.totals.requests} previous={main.data.previous.requests} />}
            />
            {activeMembers != null ? <KpiCard label="Active members" value={fmtInt(activeMembers)} /> : null}
          </KpiGrid>

          {empty ? (
            <EmptyState title="No usage in this range" hint="Try a wider date range." />
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title={variant === 'super' ? 'Credits by organisation' : 'Credits by model'}
                  caption={`Times in ${main.data.tz}`}
                  table={
                    <UsageTotalsTable rows={bucketTotals} />
                  }
                >
                  <StackedBars pivotData={pivotA!} />
                </ChartCard>
                {variant === 'super' ? (
                  <ChartCard title="Top 10 organisations" caption="By credits in this range">
                    <HorizontalBars rows={topListRows(main.data)} />
                    <TopTable rows={topListRows(main.data)} nameHeader="Organisation" />
                  </ChartCard>
                ) : (
                  <ChartCard title="Credits by job type" caption={`Times in ${main.data.tz}`}>
                    {pivotB && pivotB.rows.length > 0 ? (
                      <StackedBars pivotData={pivotB} />
                    ) : (
                      <p className="text-sm text-muted-foreground">No usage in this range.</p>
                    )}
                    <JobTypeTable rows={jobTypeTotals} />
                  </ChartCard>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Requests over time" caption={`Times in ${main.data.tz}`}>
                  <ChartContainer config={{ requests: { label: 'Requests', color: CHART_COLORS[0] } }} className="h-[240px] w-full">
                    <LineChart data={bucketTotals} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickFormatter={tickDay} />
                      <YAxis tickLine={false} axisLine={false} width={48} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="requests" stroke="var(--color-requests)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </ChartCard>
                {variant === 'owner' && topList.data ? (
                  <ChartCard title="Top members" caption="By credits in this range">
                    <HorizontalBars rows={topListRows(topList.data)} />
                    <TopTable rows={topListRows(topList.data)} nameHeader="Member" />
                  </ChartCard>
                ) : null}
              </div>

              {variant === 'super' ? <PerOrgTable result={main.data} /> : null}
            </>
          )}
        </>
      ) : null}
    </div>
  )
}

function StackedBars({ pivotData }: { pivotData: { rows: Record<string, number | string>[]; stacks: { id: string; label: string }[] } }) {
  const config = chartConfigFor(pivotData.stacks)
  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <BarChart data={pivotData.rows} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickFormatter={tickDay} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {pivotData.stacks.map((s) => (
          <Bar key={s.id} dataKey={s.id} name={s.label} stackId="credits" fill={`var(--color-${s.id})`} radius={0} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

function topListRows(result: UsageResult): { name: string; credits: number }[] {
  return result.top.map((t) => ({ name: t.key, credits: t.credits }))
}

function HorizontalBars({ rows }: { rows: { name: string; credits: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No usage in this range.</p>
  return (
    <ChartContainer config={{ credits: { label: 'Credits', color: CHART_COLORS[0] } }} className="h-[240px] w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={130}
          tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="credits" fill="var(--color-credits)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

function UsageTotalsTable({ rows }: { rows: { bucket: string; credits: number; requests: number }[] }) {
  if (rows.length === 0) return null
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bucket</TableHead>
          <TableHead className="text-right">Credits</TableHead>
          <TableHead className="text-right">Requests</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.bucket}>
            <TableCell>{r.bucket}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtInt(r.credits)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtInt(r.requests)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function JobTypeTable({ rows }: { rows: { label: string; credits: number; requests: number }[] }) {
  if (rows.length === 0) return null
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Job type</TableHead>
          <TableHead className="text-right">Credits</TableHead>
          <TableHead className="text-right">Requests</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label}>
            <TableCell>{r.label}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtInt(r.credits)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtInt(r.requests)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TopTable({ rows, nameHeader }: { rows: { name: string; credits: number }[]; nameHeader: string }) {
  if (rows.length === 0) return null
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{nameHeader}</TableHead>
          <TableHead className="text-right">Credits</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell className="max-w-[260px] truncate">{r.name}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtInt(r.credits)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Per-child aggregate table (super-org usage: series keyed by child org). */
function PerOrgTable({ result }: { result: UsageResult }) {
  const map = new Map<string, { name: string; credits: number; requests: number }>()
  for (const s of result.series) {
    const name = result.labels[s.key] ?? s.key
    const row = map.get(name) ?? { name, credits: 0, requests: 0 }
    row.credits += s.credits
    row.requests += s.requests
    map.set(name, row)
  }
  const rows = [...map.values()].sort((a, b) => b.credits - a.credits)
  if (rows.length === 0) return null
  return (
    <ChartCard title="Per organisation" caption="Aggregate for this range">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organisation</TableHead>
            <TableHead className="text-right">Credits</TableHead>
            <TableHead className="text-right">Requests</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="max-w-[280px] truncate">{r.name}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtInt(r.credits)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtInt(r.requests)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartCard>
  )
}
