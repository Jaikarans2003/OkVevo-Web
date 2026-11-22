'use client'

import type { CSSProperties } from 'react'

import { formatPctLabel } from '@/types/credits'

/** Shared % meter — billing page and dashboard (bars stay percentages only). */
export default function UsageBar({
  label,
  pct,
  spot,
}: {
  label: string
  pct: number
  spot: string
}) {
  const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
  const shown = formatPctLabel(clamped)
  return (
    <div className="pt-meter" style={{ '--spot': spot } as CSSProperties}>
      <div className="pt-meter-top">
        <p className="pt-label">{label}</p>
        <b>{shown}</b>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="pt-track"
      >
        <div
          className="pt-fill"
          data-empty={clamped === 0 ? '' : undefined}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
