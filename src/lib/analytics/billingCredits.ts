/**
 * Credits health for GET /api/billing/credits.
 * Percentages reuse billingSummary helpers. FIFO lot math mirrors
 * expireAdditional (oldest spent first → remaining balance belongs to the
 * newest inflows): top-up lots expire at credit_transactions.expires_at,
 * sponsored slices keep their slice expires_at, allocation expires at
 * billing_accounts.current_period_end.
 */
import { sponsoredRemainingPct } from '@/lib/api/billingSummary'
import { getBillingById, type DbHandle } from '@/lib/db/wallet'
import { additionalRemainingPct, remainingPct } from '@/types/credits'

export type CreditLot = { amount: number; expiresAt: Date }

export type ExpiryWindows = {
  /** Expires within the next 30 days. */
  next30: number
  days31to60: number
  days61to90: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function windowKey(expiresAt: Date, now: Date): keyof ExpiryWindows | null {
  const days = (expiresAt.getTime() - now.getTime()) / DAY_MS
  if (days <= 30) return 'next30'
  if (days <= 60) return 'days31to60'
  if (days <= 90) return 'days61to90'
  return null
}

/**
 * Attribute the remaining balance to inflow lots (ascending expires_at) and
 * sum into expiry windows. Balance beyond the lot total (legacy unseeded
 * credits) has no expiry and is left out — same ceiling as expireAdditional.
 */
export function lotExpirySchedule(
  balance: number,
  lots: readonly CreditLot[],
  now: Date
): ExpiryWindows {
  const out: ExpiryWindows = { next30: 0, days31to60: 0, days61to90: 0 }
  let remaining = Math.max(0, Math.floor(balance))
  const attributed = new Array<number>(lots.length).fill(0)
  for (let i = lots.length - 1; i >= 0 && remaining > 0; i--) {
    const take = Math.min(remaining, lots[i]!.amount)
    attributed[i] = take
    remaining -= take
  }
  for (let i = 0; i < lots.length; i++) {
    if (!attributed[i]) continue
    const key = windowKey(lots[i]!.expiresAt, now)
    if (key) out[key] += attributed[i]!
  }
  return out
}

export type CreditsHealthBucket = {
  key: 'allocation' | 'top_up' | 'sponsored'
  label: string
  remainingPct: number
  /** Soonest expiry for this bucket (period end for Plan), ISO. */
  expiresAt: string | null
  expiry: ExpiryWindows
}

export type CreditsHealth = {
  buckets: CreditsHealthBucket[]
  burn: { perDay7: number; perDay30: number }
  /** remaining / 30d average burn, rounded. Omitted when there is no burn. */
  forecastDays?: number
}

function isoOrNull(d: Date | null | undefined): string | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export async function loadCreditsHealth(
  db: DbHandle,
  billingAccountId: string,
  now: Date = new Date()
): Promise<CreditsHealth | null> {
  const billing = await getBillingById(db, billingAccountId)
  if (!billing) return null

  // One SQL: unexpired inflow lots with an expiry for both lot-based buckets.
  const lotRows = await db`
    select bucket, type, amount, expires_at
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and bucket in ('top_up', 'sponsored')
      and type in ('grant', 'transfer_in', 'debt_recovery')
      and expires_at is not null
      and expires_at > ${now}
    order by expires_at asc, created_at asc
  `
  const topUpLots: CreditLot[] = []
  const sponsoredLots: CreditLot[] = []
  for (const r of lotRows) {
    const expiresAt = r.expires_at instanceof Date ? r.expires_at : new Date(String(r.expires_at))
    if (Number.isNaN(expiresAt.getTime())) continue
    const lot = { amount: Number(r.amount) || 0, expiresAt }
    if (r.bucket === 'top_up' && (r.type === 'grant' || r.type === 'transfer_in')) {
      topUpLots.push(lot)
    } else if (r.bucket === 'sponsored' && (r.type === 'transfer_in' || r.type === 'debt_recovery')) {
      sponsoredLots.push(lot)
    }
  }

  const buckets: CreditsHealthBucket[] = []

  const allocLots: CreditLot[] =
    billing.allocationBalance > 0 && billing.currentPeriodEnd instanceof Date
      ? [{ amount: billing.allocationBalance, expiresAt: billing.currentPeriodEnd }]
      : []
  buckets.push({
    key: 'allocation',
    label: 'Plan',
    remainingPct: remainingPct(
      billing.creditsIncluded,
      billing.allocationBalance,
      billing.allocationGrantedTotal
    ),
    expiresAt: isoOrNull(billing.currentPeriodEnd),
    expiry: lotExpirySchedule(billing.allocationBalance, allocLots, now),
  })

  buckets.push({
    key: 'top_up',
    label: 'Additional',
    remainingPct: additionalRemainingPct(billing.topUpBalance, billing.topUpReference),
    expiresAt: isoOrNull(topUpLots[0]?.expiresAt ?? null),
    expiry: lotExpirySchedule(billing.topUpBalance, topUpLots, now),
  })

  if (billing.sponsoredBalance > 0 || billing.sponsoredReference > 0) {
    let label = 'From your super-organisation'
    if (billing.ownerOrgId) {
      const parent = await db`
        select p.name
        from organizations o
        join organizations p on p.id = o.parent_id
        where o.id = ${billing.ownerOrgId}
      `
      if (parent[0]?.name) label = `From ${String(parent[0].name)}`
    }
    buckets.push({
      key: 'sponsored',
      label,
      remainingPct: sponsoredRemainingPct(billing.sponsoredBalance, billing.sponsoredReference),
      expiresAt: isoOrNull(sponsoredLots[0]?.expiresAt ?? null),
      expiry: lotExpirySchedule(billing.sponsoredBalance, sponsoredLots, now),
    })
  }

  // One SQL: burn net of refunds over 7d and 30d.
  const burnRows = await db`
    select
      coalesce(sum(case when type = 'debit' then amount when type = 'refund' then -amount end)
        filter (where created_at >= ${new Date(now.getTime() - 7 * DAY_MS)}), 0)::int as net7,
      coalesce(sum(case when type = 'debit' then amount when type = 'refund' then -amount end), 0)::int as net30
    from credit_transactions
    where billing_account_id = ${billingAccountId}
      and type in ('debit', 'refund')
      and created_at >= ${new Date(now.getTime() - 30 * DAY_MS)}
  `
  const net7 = Number(burnRows[0]?.net7 ?? 0)
  const net30 = Number(burnRows[0]?.net30 ?? 0)
  const perDay7 = Math.round((net7 / 7) * 100) / 100
  const perDay30 = Math.round((net30 / 30) * 100) / 100

  const health: CreditsHealth = {
    buckets,
    burn: { perDay7, perDay30 },
  }
  if (perDay30 > 0) {
    const remaining = Math.max(
      0,
      billing.allocationBalance + billing.topUpBalance + billing.sponsoredBalance
    )
    health.forecastDays = Math.round(remaining / perDay30)
  }
  return health
}
