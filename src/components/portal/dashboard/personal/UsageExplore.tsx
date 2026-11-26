'use client'

/**
 * Usage explore: model + job-type selects, day/week/month bucket toggle,
 * KPI cards with previous-period deltas, stacked credits bars by model
 * display name (top 5 + Other) with the data table under the chart, and a
 * CSV export against the same filters (server escapes the cells).
 * Embedded by the personal Usage module and Billing › Usage.
 */
import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { authedFetch } from '@/lib/api/browser'
import type { UsageBucket, UsageSeriesRow } from '@/lib/analytics/usage'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccount } from '@/lib/orgs/accountContext'

import { deltaLabel, fmtInt, JOB_TYPE_OPTIONS, viewerTz } from './format'
import { usagePath, useUsageQuery, type UsageQueryParams } from './queries'

const ALL = 'all'
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]
const OTHER_COLOR = 'hsl(var(--muted-foreground))'
const OTHER_LABEL = 'Other'

const BUCKETS: { value: UsageBucket; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

export function useUsageExplore(keyPrefix: readonly unknown[], opts?: { enabled?: boolean }) {
  const { user } = usePortalAuth()
  const account = useAccount()
  const org = account?.account === 'org' ? account.publicId : null
  const [tz] = useState(viewerTz)
  const [model, setModel] = useState<string | null>(null)
  const [jobType, setJobType] = useState<string | null>(null)
  const [bucket, setBucket] = useState<UsageBucket>('day')
  const [csvBusy, setCsvBusy] = useState(false)

  const params: UsageQueryParams = { tz, bucket, groupBy: 'model', model, jobType }
  // Options for the model select come from the same view without the model
  // filter, so picking a model never collapses the list to that one model.
  const optionsParams: UsageQueryParams = { ...params, model: null }

  const chart = useUsageQuery(
    [...keyPrefix, 'chart', tz, bucket, model ?? '', jobType ?? ''],
    params,
    opts
  )
  const options = useUsageQuery(
    [...keyPrefix, 'options', tz, bucket, jobType ?? ''],
    optionsParams,
    opts
  )

  const modelOptions = useMemo(() => {
    const labels = options.data?.labels ?? {}
    return Object.entries(labels)
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [options.data])

  const downloadCsv = async () => {
    if (!user || csvBusy) return
    setCsvBusy(true)
    try {
      const res = await authedFetch(user, usagePath(params, 'csv'), { org })
      if (!res.ok) throw new Error(`export_failed_${res.status}`)
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = 'usage.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setCsvBusy(false)
    }
  }

  return {
    query: chart,
    optionsQuery: options,
    model,
    setModel,
    jobType,
    setJobType,
    bucket,
    setBucket,
    modelOptions,
    downloadCsv,
    csvBusy,
  }
}

export type UsageExploreState = ReturnType<typeof useUsageExplore>

type ChartRow = { bucket: string; requests: number } & Record<string, number | string>
type SeriesKey = { dataKey: string; label: string }

/** Merge raw series keys into display labels; keep the top 5, fold the rest into Other. */
function shapeSeries(series: UsageSeriesRow[], labels: Record<string, string>) {
  const byLabel = new Map<string, number>()
  for (const row of series) {
    const label = labels[row.key] ?? row.key
    byLabel.set(label, (byLabel.get(label) ?? 0) + row.credits)
  }
  const ranked = [...byLabel.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const top = ranked.slice(0, 5).map(([label]) => label)
  const kept = new Set(top)
  const shown = ranked.length > 5 ? [...top, OTHER_LABEL] : top
  // dataKeys must be CSS-ident-safe for the chart's --color-* vars; labels live in config.
  const keys: SeriesKey[] = shown.map((label, i) => ({ dataKey: `s${i}`, label }))
  const dataKeyFor = new Map(keys.map((k) => [k.label, k.dataKey]))

  const buckets: string[] = []
  const perBucket = new Map<string, ChartRow>()
  for (const row of series) {
    let out = perBucket.get(row.bucket)
    if (!out) {
      out = { bucket: row.bucket, requests: 0 }
      perBucket.set(row.bucket, out)
      buckets.push(row.bucket)
    }
    const label = labels[row.key] ?? row.key
    const seriesKey = dataKeyFor.get(kept.has(label) ? label : OTHER_LABEL)
    if (seriesKey) out[seriesKey] = (Number(out[seriesKey]) || 0) + row.credits
    out.requests += row.requests
  }
  const rows = buckets.sort().map((b) => perBucket.get(b)!)
  for (const row of rows) {
    for (const k of keys) row[k.dataKey] = (Number(row[k.dataKey]) || 0)
  }

  const config: ChartConfig = {}
  keys.forEach((k, i) => {
    config[k.dataKey] = {
      label: k.label,
      color: k.label === OTHER_LABEL ? OTHER_COLOR : CHART_COLORS[i % CHART_COLORS.length],
    }
  })
  return { rows, keys, config }
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string
  value: string
  delta: string | null
}) {
  return (
    <div className="rounded-xl border bg-card p-5 text-card-foreground shadow">
      <p className="pt-label">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="pt-fine mt-1">{delta ?? '—'}</p>
    </div>
  )
}

export default function UsageExplore({ state }: { state: UsageExploreState }) {
  const { query } = state
  const result = query.data

  const shaped = useMemo(
    () => (result ? shapeSeries(result.series, result.labels) : null),
    [result]
  )

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="pt-field">
          <label htmlFor="usage-model">Model</label>
          <Select
            value={state.model ?? ALL}
            onValueChange={(v) => state.setModel(v === ALL ? null : v)}
          >
            <SelectTrigger id="usage-model" className="w-[220px]">
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
          <label htmlFor="usage-job-type">Job type</label>
          <Select
            value={state.jobType ?? ALL}
            onValueChange={(v) => state.setJobType(v === ALL ? null : v)}
          >
            <SelectTrigger id="usage-job-type" className="w-[180px]">
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
          <span id="usage-bucket-label" className="pt-label">
            Group by
          </span>
          <div
            role="group"
            aria-labelledby="usage-bucket-label"
            className="inline-flex h-9 items-center rounded-lg bg-muted p-1"
          >
            {BUCKETS.map((b) => (
              <button
                key={b.value}
                type="button"
                aria-pressed={state.bucket === b.value}
                onClick={() => state.setBucket(b.value)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
                  state.bucket === b.value
                    ? 'bg-background text-foreground shadow'
                    : 'text-muted-foreground'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn ml-auto"
          onClick={state.downloadCsv}
          disabled={state.csvBusy || !result || result.series.length === 0}
        >
          <Download size={15} aria-hidden />
          {state.csvBusy ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {query.isPending ? (
        <div className="grid gap-5" role="status" aria-busy="true" aria-label="Loading usage">
          <Skeleton className="h-24 rounded-[var(--r)]" />
          <Skeleton className="h-72 rounded-[var(--r)]" />
        </div>
      ) : query.isError ? (
        <p className="pt-note pt-note--bad" role="alert">
          Couldn’t load usage. {query.error.message}
        </p>
      ) : result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Kpi
              label="Credits used"
              value={fmtInt(result.totals.credits)}
              delta={deltaLabel(result.totals.credits, result.previous.credits)}
            />
            <Kpi
              label="Requests"
              value={fmtInt(result.totals.requests)}
              delta={deltaLabel(result.totals.requests, result.previous.requests)}
            />
          </div>

          {shaped && shaped.rows.length > 0 ? (
            <div className="rounded-xl border bg-card p-5 text-card-foreground shadow">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Credits over time</h2>
                <p className="pt-fine">
                  {result.from} → {result.to} · Times in {result.tz}
                </p>
              </div>
              <ChartContainer config={shaped.config} className="h-72 w-full">
                <BarChart data={shaped.rows} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {shaped.keys.map((k, i) => (
                    <Bar
                      key={k.dataKey}
                      dataKey={k.dataKey}
                      name={k.label}
                      stackId="credits"
                      fill={`var(--color-${k.dataKey})`}
                      radius={i === shaped.keys.length - 1 ? [3, 3, 0, 0] : 0}
                    />
                  ))}
                </BarChart>
              </ChartContainer>

              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{result.bucket === 'month' ? 'Month' : 'Day'}</TableHead>
                      {shaped.keys.map((k) => (
                        <TableHead key={k.dataKey} className="text-right">
                          {k.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Requests</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shaped.rows.map((row) => (
                      <TableRow key={row.bucket}>
                        <TableCell className="font-medium">{row.bucket}</TableCell>
                        {shaped.keys.map((k) => (
                          <TableCell key={k.dataKey} className="text-right tabular-nums">
                            {fmtInt(Number(row[k.dataKey]) || 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(row.requests)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="pt-empty rounded-xl border bg-card shadow">
              <p className="text-lg font-semibold">No usage in this range</p>
              <p className="pt-fine">Try a different model, job type or bucket.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
