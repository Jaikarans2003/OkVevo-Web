'use client'

/**
 * Billing › Credits: bucket meters (Plan / Additional / From {super} when the
 * API includes it), per-bucket expiry windows, burn rates, and the 30-day
 * forecast. Every card renders only when the API returns the value.
 */
import type { CSSProperties } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { formatPctLabel } from '@/types/credits'

import { fmtCredits, fmtDate, fmtInt } from './format'
import type { useCreditsQuery } from './queries'

const WINDOWS = [
  { key: 'next30', label: 'Next 30 days' },
  { key: 'days31to60', label: '31–60 days' },
  { key: 'days61to90', label: '61–90 days' },
] as const

export default function CreditsPanel({
  query,
}: {
  query: ReturnType<typeof useCreditsQuery>
}) {
  if (query.isPending) {
    return (
      <div className="grid gap-4" role="status" aria-busy="true" aria-label="Loading credits">
        <Skeleton className="h-36 rounded-[var(--r)]" />
        <Skeleton className="h-36 rounded-[var(--r)]" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <p className="pt-note pt-note--bad" role="alert">
        Couldn’t load credits. {query.error.message}
      </p>
    )
  }
  const health = query.data
  if (!health) return null

  const hasExpiry = health.buckets.some(
    (b) => b.expiry.next30 > 0 || b.expiry.days31to60 > 0 || b.expiry.days61to90 > 0
  )

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {health.buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="pt-meter"
            style={{ '--spot': 'var(--orange)' } as CSSProperties}
          >
            <div className="pt-meter-top">
              <span className="pt-label">{bucket.label}</span>
              <b>{formatPctLabel(bucket.remainingPct)}</b>
            </div>
            <div
              className="pt-track"
              role="progressbar"
              aria-label={`${bucket.label} credits remaining`}
              aria-valuenow={Math.round(bucket.remainingPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="pt-fill"
                data-empty={bucket.remainingPct <= 0 || undefined}
                style={{ width: `${Math.max(0, Math.min(100, bucket.remainingPct))}%` }}
              />
            </div>
            {bucket.expiresAt ? (
              <p className="pt-fine">Next expiry {fmtDate(bucket.expiresAt)} (UTC)</p>
            ) : null}
            {bucket.expiry.next30 > 0 ||
            bucket.expiry.days31to60 > 0 ||
            bucket.expiry.days61to90 > 0 ? (
              <dl className="grid gap-1 text-sm">
                {WINDOWS.map((w) =>
                  bucket.expiry[w.key] > 0 ? (
                    <div key={w.key} className="flex items-baseline justify-between gap-2">
                      <dt className="pt-fine">{w.label}</dt>
                      <dd className="tabular-nums">{fmtInt(bucket.expiry[w.key])}</dd>
                    </div>
                  ) : null
                )}
              </dl>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 text-card-foreground shadow">
          <p className="pt-label">Burn rate · 7 days</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {fmtCredits(health.burn.perDay7)}
          </p>
          <p className="pt-fine mt-1">credits per day, net of refunds</p>
        </div>
        <div className="rounded-xl border bg-card p-5 text-card-foreground shadow">
          <p className="pt-label">Burn rate · 30 days</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {fmtCredits(health.burn.perDay30)}
          </p>
          <p className="pt-fine mt-1">credits per day, net of refunds</p>
        </div>
        {health.forecastDays != null ? (
          <div className="rounded-xl border bg-card p-5 text-card-foreground shadow">
            <p className="pt-label">Forecast</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              Lasts about {fmtInt(health.forecastDays)} days
            </p>
            <p className="pt-fine mt-1">Estimate, based on the last 30 days</p>
          </div>
        ) : null}
      </div>

      {!hasExpiry ? (
        <p className="pt-fine">No credits are due to expire in the next 90 days.</p>
      ) : null}
    </div>
  )
}
