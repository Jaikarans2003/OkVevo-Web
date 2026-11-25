/**
 * Payments page for GET /api/billing/payments.
 * Rows are successful money events from the credit ledger: top-up grants
 * (`rp_{paymentId}`) and subscription cycle grants (`sub_activated_*` /
 * `sub_charged_{subscriptionId}_{cycle}`). Failed payments are never stored,
 * so every row is a success. Keyset-paged via lib/analytics/cursor.
 */
import { billingDisplayStatus } from '@/lib/api/billingSummary'
import { decodeCursor, encodeCursor } from '@/lib/analytics/cursor'
import type { BillingAccountData, DbHandle } from '@/lib/db/wallet'

const PAGE = 50

export type PaymentRef =
  | { kind: 'top_up'; paymentId: string }
  | { kind: 'sub_charged'; subscriptionId: string; cycle: number }
  | { kind: 'sub_activated'; subscriptionId: string }

/** Parse the ledger request_id into a payment reference. Null when not a payment row. */
export function parsePaymentRequestId(requestId: string | null): PaymentRef | null {
  if (!requestId) return null
  if (requestId.startsWith('rp_')) {
    const paymentId = requestId.slice(3)
    return paymentId ? { kind: 'top_up', paymentId } : null
  }
  if (requestId.startsWith('sub_charged_')) {
    const rest = requestId.slice('sub_charged_'.length)
    const cut = rest.lastIndexOf('_')
    if (cut <= 0) return null
    const subscriptionId = rest.slice(0, cut)
    const cycle = Number(rest.slice(cut + 1))
    if (!subscriptionId || !Number.isInteger(cycle)) return null
    return { kind: 'sub_charged', subscriptionId, cycle }
  }
  if (requestId.startsWith('sub_activated_')) {
    let rest = requestId.slice('sub_activated_'.length)
    // Real rows append `_${current_start}` (unix seconds); drop that suffix.
    const m = /^(.*)_\d{9,}$/.exec(rest)
    if (m) rest = m[1]!
    return rest ? { kind: 'sub_activated', subscriptionId: rest } : null
  }
  return null
}

export type PaymentRow = {
  id: string
  /** ISO date. */
  date: string
  type: 'Subscription' | 'Top-up'
  plan: string | null
  /** Subscriptions: current sub status. Top-ups: always Paid (failures aren't stored). */
  status: string
  /** Razorpay id column: payment id for top-ups / latest cycle; `{subId}/{cycle}` otherwise. */
  razorpayId: string
  subscriptionId?: string
  cycle?: number
}

export type PaymentsPage = {
  /** Subscription status + renewal line; omitted when the wallet has no plan. */
  header?: { status: string | null; line: string | null }
  items: PaymentRow[]
  nextCursor: string | null
}

export async function listPayments(
  db: DbHandle,
  opts: {
    billing: BillingAccountData
    cursor: string | null
    now?: Date
  }
): Promise<PaymentsPage> {
  const billing = opts.billing
  const cursor = decodeCursor(opts.cursor)
  if (opts.cursor && !cursor) throw new Error('invalid_cursor')

  const rows = await db`
    select id, request_id, created_at
    from credit_transactions
    where billing_account_id = ${billing.id}
      and type = 'grant'
      and (
        (bucket = 'top_up' and request_id ~ '^rp_')
        or (bucket = 'allocation' and request_id ~ '^sub_(charged|activated)_')
      )
      ${cursor ? db`and (created_at, id) < (${cursor.at}::timestamptz, ${cursor.id})` : db``}
    order by created_at desc, id desc
    limit ${PAGE + 1}
  `

  const subRows = await db`
    select id, status, charge_count, last_payment_id
    from razorpay_subscriptions
    where billing_account_id = ${billing.id}
  `
  const subs = new Map(
    subRows.map((r) => [
      String(r.id),
      {
        status: (r.status as string | null) ?? null,
        chargeCount: Number(r.charge_count) || 0,
        lastPaymentId: (r.last_payment_id as string | null) ?? null,
      },
    ])
  )

  const plan = billing.planName ?? billing.plan
  const page = rows.slice(0, PAGE)
  const items: PaymentRow[] = []
  for (const r of page) {
    const ref = parsePaymentRequestId((r.request_id as string | null) ?? null)
    if (!ref) continue
    const date =
      r.created_at instanceof Date ? r.created_at.toISOString() : new Date(String(r.created_at)).toISOString()
    if (ref.kind === 'top_up') {
      items.push({
        id: String(r.id),
        date,
        type: 'Top-up',
        plan,
        status: 'Paid',
        razorpayId: ref.paymentId,
      })
    } else {
      const sub = subs.get(ref.subscriptionId)
      const cycle = ref.kind === 'sub_charged' ? ref.cycle : null
      let razorpayId = ref.subscriptionId
      if (cycle != null) {
        razorpayId =
          sub?.lastPaymentId && cycle === sub.chargeCount
            ? sub.lastPaymentId
            : `${ref.subscriptionId}/${cycle}`
      }
      items.push({
        id: String(r.id),
        date,
        type: 'Subscription',
        plan,
        status: sub?.status ?? billing.planStatus ?? 'active',
        razorpayId,
        subscriptionId: ref.subscriptionId,
        ...(cycle != null ? { cycle } : {}),
      })
    }
  }

  const last = page[page.length - 1]
  const nextCursor =
    rows[PAGE] && last
      ? encodeCursor(
          last.created_at instanceof Date
            ? last.created_at.toISOString()
            : String(last.created_at),
          String(last.id)
        )
      : null

  const out: PaymentsPage = { items, nextCursor }
  const status = billingDisplayStatus(billing, opts.now ?? new Date())
  if (status) {
    const periodEnd =
      billing.currentPeriodEnd instanceof Date && !Number.isNaN(billing.currentPeriodEnd.getTime())
        ? billing.currentPeriodEnd.toISOString().slice(0, 10)
        : null
    out.header = {
      status,
      line: periodEnd ? `${billing.cancelAtPeriodEnd ? 'Ends' : 'Renews'} ${periodEnd}` : null,
    }
  }
  return out
}
