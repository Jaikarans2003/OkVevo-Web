'use client'

/**
 * Personal Overview (plan §2): bucket meters (Plan / Additional / From
 * {super} — each only when the API has a value), Used-this-period with the
 * previous-period delta, and the 30-day credits bar chart. Polls every 60s
 * while the tab is visible (plan §1 freshness).
 */
import Link from 'next/link'
import { useMemo, useState, type CSSProperties } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import type { BillingSummary } from '@/lib/api/billingSummary'
import ModulePage from '@/components/portal/ModulePage'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { accountKey, useAccount } from '@/lib/orgs/accountContext'
import { formatPctLabel } from '@/types/credits'

import { deltaLabel, fmtDate, fmtInt, JOB_TYPE_OPTIONS, viewerTz } from './format'
import { useSummaryQuery, useUsageQuery } from './queries'

const JOB_TYPE_COLORS: Record<string, string> = {
  Chat: 'hsl(var(--chart-1))',
  Search: 'hsl(var(--chart-2))',
  Image: 'hsl(var(--chart-3))',
  Video: 'hsl(var(--chart-4))',
  Audio: 'hsl(var(--chart-5))',
}

function Meter({
  label,
  pct,
  sub,
}: {
  label: string
  pct: number
  sub?: string | null
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="pt-meter" style={{ '--spot': 'var(--orange)' } as CSSProperties}>
      <div className="pt-meter-top">
        <span className="pt-label">{label}</span>
        <b>{formatPctLabel(pct)}</b>
      </div>
      <div
        className="pt-track"
        role="progressbar"
        aria-label={`${label} credits remaining`}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="pt-fill"
          data-empty={clamped <= 0 || undefined}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {sub ? <p className="pt-fine">{sub}</p> : null}
    </div>
  )
}

/** 30-day credits bars, stacked by job type (series keys are already display labels). */
function CreditsChart({ usage }: { usage: ReturnType<typeof useUsageQuery> }) {
  const shaped = useMemo(() => {
    const result = usage.data
    if (!result) return null
    const present = new Set(result.series.map((s) => s.key))
    const keys: string[] = JOB_TYPE_OPTIONS.map((o) => o.label).filter((l) => present.has(l))
    for (const s of result.series) {
      if (!keys.includes(s.key)) keys.push(s.key)
    }
    const perBucket = new Map<string, Record<string, number | string>>()
    for (const row of result.series) {
      let out = perBucket.get(row.bucket)
      if (!out) {
        out = { bucket: row.bucket }
        perBucket.set(row.bucket, out)
      }
      out[row.key] = (Number(out[row.key]) || 0) + row.credits
    }
    const rows = [...perBucket.values()].sort((a, b) =>
      String(a.bucket).localeCompare(String(b.bucket))
    )
    for (const row of rows) {
      for (const k of keys) row[k] = (Number(row[k]) || 0)
    }
    const config: ChartConfig = {}
    keys.forEach((k, i) => {
      config[k] = { label: k, color: JOB_TYPE_COLORS[k] ?? `hsl(var(--chart-${(i % 5) + 1}))` }
    })
    return { rows, keys, config }
  }, [usage.data])

  return (
    <div className="rounded-xl border bg-card p-5 text-card-foreground shadow">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Credits, last 30 days</h2>
        {usage.data ? (
          <p className="pt-fine">
            {usage.data.from} → {usage.data.to} · Times in {usage.data.tz}
          </p>
        ) : null}
      </div>
      {usage.isPending ? (
        <Skeleton className="h-64 rounded-[var(--r)]" />
      ) : usage.isError ? (
        <p className="pt-note pt-note--bad" role="alert">
          Couldn’t load usage. {usage.error.message}
        </p>
      ) : shaped && shaped.rows.length > 0 ? (
        <ChartContainer config={shaped.config} className="h-64 w-full">
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
                key={k}
                dataKey={k}
                stackId="credits"
                fill={`var(--color-${k})`}
                radius={i === shaped.keys.length - 1 ? [3, 3, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="pt-fine py-10 text-center">No usage in the last 30 days.</p>
      )}
    </div>
  )
}

function planSub(summary: BillingSummary): string | null {
  const parts: string[] = []
  if (summary.planName) parts.push(summary.planName)
  if (summary.periodEnd) {
    parts.push(
      `${summary.cancelAtPeriodEnd ? 'Ends' : 'Renews'} ${fmtDate(summary.periodEnd)} (UTC)`
    )
  }
  return parts.length ? parts.join(' · ') : null
}

export default function PersonalOverview() {
  const account = useAccount()
  const base = ['overview', accountKey(account)] as const
  const [tz] = useState(viewerTz)

  const summary = useSummaryQuery([...base, 'summary'], { refetchInterval: 60_000 })
  const usage = useUsageQuery(
    [...base, 'usage', tz],
    { tz, bucket: 'day', groupBy: 'job_type', model: null, jobType: null },
    { refetchInterval: 60_000 }
  )

  const data = summary.data
  const noUsage = usage.data ? usage.data.series.length === 0 : false
  const choosePlan = data != null && !data.plan && noUsage

  return (
    <ModulePage
      title="Overview"
      placeholder="Overview module lands in the next wave."
      queryKey={base}
      query={summary}
    >
      {summary.isError ? (
        <p className="pt-note pt-note--bad" role="alert">
          Couldn’t load your credits. {summary.error.message}
        </p>
      ) : data ? (
        <div className="grid gap-6">
          {choosePlan ? (
            <div className="pt-empty rounded-xl border bg-card shadow">
              <p className="text-lg font-semibold">You’re on the free account</p>
              <p className="pt-fine">Choose a plan to start creating with OkVevo.</p>
              <Link className="btn btn--go" href="/pricing">
                Choose a plan
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {data.plan ? <Meter label="Plan" pct={data.remainingPct} sub={planSub(data)} /> : null}
                {data.additionalPct > 0 || data.additionalNextExpiry || !data.plan ? (
                  <Meter
                    label="Additional"
                    pct={data.additionalPct}
                    sub={
                      data.additionalNextExpiry
                        ? `Next expiry ${fmtDate(data.additionalNextExpiry)} (UTC)`
                        : null
                    }
                  />
                ) : null}
                {data.sponsoredPct > 0 ? (
                  <Meter
                    label={data.fundedBy ? `From ${data.fundedBy}` : 'From your super-organisation'}
                    pct={data.sponsoredPct}
                  />
                ) : null}
                <div className="rounded-xl border bg-card p-5 text-card-foreground shadow">
                  <p className="pt-label">Used this period</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {usage.data ? fmtInt(usage.data.totals.credits) : '—'}
                  </p>
                  <p className="pt-fine mt-1">
                    {usage.data
                      ? (deltaLabel(usage.data.totals.credits, usage.data.previous.credits) ??
                        'First period with usage')
                      : 'Loading…'}
                  </p>
                </div>
              </div>
              <CreditsChart usage={usage} />
            </>
          )}
        </div>
      ) : null}
    </ModulePage>
  )
}
