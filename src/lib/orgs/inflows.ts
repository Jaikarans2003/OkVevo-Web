/**
 * Oldest-expiry-first remaining on top-up inflows.
 * Spent additional credits consume oldest purchases first, so leftover
 * belongs to the newest (plan §5.2).
 */

export type TopUpInflow = {
  id: string
  amount: number
  expiresAt: Date | null
  createdAt: Date
}

export type InflowSlice = {
  inflowId: string
  amount: number
  expiresAt: Date | null
}

/** Remaining credits per inflow after FIFO spend from the oldest. */
export function remainingByInflow(
  inflows: TopUpInflow[],
  topUpBalance: number
): InflowSlice[] {
  const ordered = [...inflows].sort((a, b) => {
    const ae = a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY
    const be = b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY
    if (ae !== be) return ae - be
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
  const totalIn = ordered.reduce((s, r) => s + r.amount, 0)
  let spent = Math.max(0, totalIn - Math.max(0, topUpBalance))
  const out: InflowSlice[] = []
  for (const row of ordered) {
    const remaining = Math.max(0, row.amount - spent)
    spent = Math.max(0, spent - row.amount)
    if (remaining > 0) {
      out.push({ inflowId: row.id, amount: remaining, expiresAt: row.expiresAt })
    }
  }
  return out
}

/** Take `need` credits from remaining slices (oldest first). */
export function takeFromRemaining(
  remaining: InflowSlice[],
  need: number
): InflowSlice[] {
  if (!Number.isInteger(need) || need <= 0) return []
  let left = need
  const out: InflowSlice[] = []
  for (const slice of remaining) {
    if (left <= 0) break
    const take = Math.min(left, slice.amount)
    if (take > 0) {
      out.push({ inflowId: slice.inflowId, amount: take, expiresAt: slice.expiresAt })
      left -= take
    }
  }
  if (left > 0) return [] // insufficient
  return out
}
