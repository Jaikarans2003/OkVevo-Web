'use client'

/**
 * Billing › Payments: subscription renewal line (server-formatted, UTC) and
 * the keyset-paged payments list — top-ups and subscription cycles from the
 * credit ledger. Failed payments are never stored, so every row is a success.
 */
import {
  columnVisibilityFeature,
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'

import type { PaymentRow } from '@/lib/analytics/payments'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { fmtDate, paymentStatusVariant } from './format'
import type { usePaymentsQuery } from './queries'

/* Only column visibility is registered: rows render via row.getVisibleCells().
   Paging stays server-side, so no v9 row-model features are needed. */
const features = tableFeatures({ columnVisibilityFeature })
const columnHelper = createColumnHelper<typeof features, PaymentRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('date', {
    header: 'Date',
    cell: (c) => fmtDate(c.getValue()),
  }),
  columnHelper.accessor('type', {
    header: 'Type',
    cell: (c) => (
      <Badge variant={c.getValue() === 'Subscription' ? 'default' : 'secondary'}>
        {c.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor('plan', {
    header: 'Plan',
    cell: (c) => c.getValue() ?? '—',
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (c) => (
      <Badge variant={paymentStatusVariant(c.getValue())} className="capitalize">
        {c.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor('razorpayId', {
    header: 'Razorpay id',
    cell: (c) => <span className="font-mono text-xs break-all">{c.getValue()}</span>,
  }),
])

export default function PaymentsTable({
  query,
}: {
  query: ReturnType<typeof usePaymentsQuery>
}) {
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  const header = query.data?.pages[0]?.header
  const table = useTable({ features, data: items, columns })

  if (query.isPending) {
    return (
      <div className="grid gap-3" aria-busy="true" aria-label="Loading payments">
        <Skeleton className="h-16 rounded-[var(--r)]" />
        <Skeleton className="h-64 rounded-[var(--r)]" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <p className="pt-note pt-note--bad" role="alert">
        Couldn’t load payments. {query.error.message}
      </p>
    )
  }

  return (
    <div className="grid gap-4">
      {header ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow">
          <Badge variant={paymentStatusVariant(header.status ?? '')} className="capitalize">
            {header.status ?? 'No plan'}
          </Badge>
          {header.line ? <p className="text-sm">{header.line} (UTC)</p> : null}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="pt-empty rounded-xl border bg-card shadow">
          <p className="text-lg font-semibold">No payments yet</p>
          <p className="pt-fine">Plans and top-ups you pay for will show up here.</p>
          <a className="btn btn--go" href="/pricing">
            See plans
          </a>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {query.hasNextPage ? (
            <div className="border-t p-3">
              <button
                type="button"
                className="btn"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
