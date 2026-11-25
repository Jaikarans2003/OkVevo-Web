/**
 * Formatting, date-range presets and CSV download for the org dashboard.
 * All dates render in the viewer's time zone (spec: "Times in {tz}").
 */
import type { User } from 'firebase/auth'

import { authedFetch } from '@/lib/api/browser'

export const VIEWER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US')

export const fmtPct = (n: number): string => `${Math.floor(n)}%`

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d)
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : TIME_FMT.format(d)
}

/** YYYY-MM-DD in the viewer's local time (usage API takes local dates + tz). */
export function localDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type DatePreset = '7d' | '30d' | '90d' | 'month' | 'last_month' | 'custom'

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
]

export function rangeForPreset(preset: Exclude<DatePreset, 'custom'>): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === 'month') {
    return { from: localDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: localDay(today) }
  }
  if (preset === 'last_month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const last = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: localDay(first), to: localDay(last) }
  }
  const days = preset === '7d' ? 6 : preset === '30d' ? 29 : 89
  return { from: localDay(new Date(today.getTime() - days * 864e5)), to: localDay(today) }
}

/** Small customer-facing wording for known API error codes; unknown codes pass through. */
export function errorText(code: string): string {
  switch (code) {
    case 'org_access_denied':
      return 'You don’t have access to this.'
    case 'insufficient_quota':
      return 'Not enough credits available to send.'
    case 'plan_not_active':
      return 'The organisation’s plan isn’t active.'
    case 'not_child':
      return 'That organisation isn’t part of this super-organisation.'
    case 'jobs_in_flight':
      return 'Jobs are still running — try again shortly.'
    case 'last_owner':
      return 'The last owner can’t leave the organisation.'
    case 'invalid_code':
      return 'That code isn’t valid.'
    case 'revoked':
      return 'That code has been replaced.'
    case 'not_super_code':
      return 'That code is for an organisation, not a super-organisation.'
    case 'already_parented':
      return 'This organisation already belongs to a super-organisation.'
    case 'confirm_mismatch':
      return 'The confirmation doesn’t match the name.'
    case 'invalid_name':
      return 'Enter a valid name.'
    default:
      return code.replace(/_/g, ' ')
  }
}

/** Authenticated CSV download (export endpoints need the Bearer header, so no plain <a>). */
export async function downloadCsv(user: User, path: string, org: string | null, filename: string) {
  const res = await authedFetch(user, path, { org })
  if (!res.ok) {
    let code = `request_failed_${res.status}`
    try {
      const data = (await res.json()) as { error?: unknown }
      if (typeof data.error === 'string') code = data.error
    } catch {
      /* keep status code */
    }
    throw new Error(code)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
