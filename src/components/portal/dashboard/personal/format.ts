/**
 * Shared display helpers for the personal dashboard modules.
 * Wording comes from API fields (modelLabel, jobType, labels, reasons);
 * the maps below cover only DB enum codes the API must send raw
 * (ledger type / bucket), mirroring the server's humanise fallback.
 */

export const fmtInt = (n: number): string => n.toLocaleString()

export const fmtCredits = (n: number): string =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Viewer's IANA time zone, sent as the usage `tz` param. */
export function viewerTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** 'cron.allocation_refresh' → 'Cron allocation refresh' (server humanise fallback). */
export function humanize(code: string): string {
  const text = code.replace(/[._-]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : code
}

/** credit_transactions.type → customer label. */
export const TX_TYPE_LABELS: Record<string, string> = {
  grant: 'Credit',
  debit: 'Debit',
  refund: 'Refund',
  expire: 'Expired',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  debt_recovery: 'Debt recovery',
}

/** credit_transactions.bucket → wallet label (matches the summary cards). */
export const BUCKET_LABELS: Record<string, string> = {
  allocation: 'Plan',
  top_up: 'Additional',
  sponsored: 'Sponsored',
}

/** Ledger rows that reduce the balance render with a minus sign. */
const NEGATIVE_TYPES = new Set(['debit', 'expire', 'transfer_out', 'debt_recovery'])

export function signedAmount(type: string, amount: number): string {
  return `${NEGATIVE_TYPES.has(type) ? '−' : '+'}${fmtInt(amount)}`
}

/** Usage / jobs job_type filter options (API param values + display labels). */
export const JOB_TYPE_OPTIONS = [
  { value: 'chat', label: 'Chat' },
  { value: 'search', label: 'Search' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
] as const

/** gateway_jobs statuses the API accepts as a filter. */
export const JOB_STATUS_OPTIONS = [
  { value: 'reserved', label: 'Reserved' },
  { value: 'queued', label: 'Queued' },
  { value: 'dispatching', label: 'Dispatching' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'settled', label: 'Settled' },
  { value: 'released', label: 'Released' },
] as const

/** Statuses that mean "still running" — the jobs table polls while any row has one. */
export const IN_PROGRESS_STATUSES = new Set(['reserved', 'queued', 'dispatching', 'submitted'])

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export function jobStatusVariant(status: string): BadgeVariant {
  if (status === 'settled') return 'secondary'
  if (IN_PROGRESS_STATUSES.has(status)) return 'default'
  return 'outline'
}

export function paymentStatusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'paid') return 'secondary'
  if (s === 'halted') return 'destructive'
  if (s === 'cancelled' || s === 'completed' || s === 'ended') return 'outline'
  return 'default'
}

export function txTypeVariant(type: string): BadgeVariant {
  if (type === 'debit') return 'outline'
  if (type === 'expire') return 'destructive'
  if (type === 'refund') return 'secondary'
  return 'default'
}

/** Period-over-period delta label, or null when there is no previous period. */
export function deltaLabel(current: number, previous: number): string | null {
  if (previous <= 0) return null
  const pct = ((current - previous) / previous) * 100
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10
  if (rounded === 0) return 'No change vs previous period'
  return `${rounded > 0 ? '+' : ''}${rounded}% vs previous period`
}
