'use client'

/**
 * Small shared UI pieces for the org dashboard modules: KPI cards, wallet
 * bars, deltas, empty/error states, chart frame. shadcn neutral + orange.
 */
import { AlertCircle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { fmtInt } from './dashboard-utils'

/** Chart palette: OkVevo orange + shell neutrals only (no other accent). */
export const CHART_COLORS = [
  'hsl(24 100% 56%)',
  'hsl(0 0% 16%)',
  'hsl(30 24% 55%)',
  'hsl(34 6% 46%)',
  'hsl(30 8% 70%)',
  'hsl(38 25% 82%)',
]

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" aria-hidden /> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
}

/** Wallet / pool percentage bar (percentages only — never exact credits). */
export function PctBar({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Signed change vs the previous equal period ("+12% vs previous"). */
export function DeltaLabel({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous
  if (delta === 0) return <span className="text-muted-foreground">No change vs previous</span>
  const sign = delta > 0 ? '+' : '−'
  const pctText =
    previous > 0 ? ` (${sign}${Math.round(Math.abs((delta / previous) * 100))}%)` : ''
  return (
    <span className={delta > 0 ? 'text-foreground' : 'text-muted-foreground'}>
      {sign}
      {fmtInt(Math.abs(delta))}
      {pctText} vs previous
    </span>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-lg font-medium">{title}</p>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </CardContent>
    </Card>
  )
}

/** Inline query/mutation error (role=alert). */
export function ErrorNote({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'request_failed'
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <span>{message.replace(/_/g, ' ')}</span>
    </div>
  )
}

/** Card wrapper for one chart + its data table (spec: table under each chart). */
export function ChartCard({
  title,
  caption,
  children,
  table,
}: {
  title: string
  caption?: string
  children: ReactNode
  table?: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {children}
        {table}
      </CardContent>
    </Card>
  )
}
