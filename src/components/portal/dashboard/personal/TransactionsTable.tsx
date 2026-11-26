'use client'

/**
 * Billing › Transactions: cursor-paged ledger for the paying wallet.
 * Description comes from the API's modelLabel/jobType for usage rows and
 * the stored reason (humanised) otherwise — never raw model or provider.
 */
import {
  columnVisibilityFeature,
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'

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
import type { LedgerItem } from '@/lib/api/billingTransactions'

import {
  BUCKET_LABELS,
  fmtDateTime,
  humanize,
  signedAmount,
  TX_TYPE_LABELS,
  txTypeVariant,
} from './format'
import { useTransactionsQuery } from './queries'

/* Only column visibility is registered: rows render via row.getVisibleCells().
   Sorting/paging stay server-side, so no v9 row-model features are needed. */
const features = tableFeatures({ columnVisibilityFeature })
const columnHelper = createColumnHelper<typeof features, LedgerItem>()

function description(tx: LedgerItem): { title: string; sub: string | null } {
  if (tx.type === 'debit' || tx.type === 'refund') {
    return { title: tx.modelLabel, sub: tx.jobType }
  }
  if (tx.reason) return { title: humanize(tx.reason), sub: null }
  const bucket = tx.bucket ? BUCKET_LABELS[tx.bucket] : null
  return { title: bucket ? `${bucket} credits` : humanize(tx.type), sub: null }
}

const columns = columnHelper.columns([
  columnHelper.accessor('createdAt', {
    header: 'Date',
    cell: (c) => fmtDateTime(c.getValue()),
  }),
  columnHelper.accessor('id', {
    id: 'description',
    header: 'Description',
    cell: (c) => {
      const d = description(c.row.original)
      return (
        <div>
          <p className="font-medium">{d.title}</p>
          {d.sub ? <p className="pt-fine">{d.sub}</p> : null}
        </div>
      )
    },
  }),
  columnHelper.accessor('type', {
    header: 'Type',
    cell: (c) => (
      <Badge variant={txTypeVariant(c.getValue())}>
        {TX_TYPE_LABELS[c.getValue()] ?? humanize(c.getValue())}
      </Badge>
    ),
  }),
  columnHelper.accessor('amount', {
    header: 'Amount',
    cell: (c) => (
      <span className="tabular-nums">{signedAmount(c.row.original.type, c.getValue())}</span>
    ),
  }),
  columnHelper.accessor('bucket', {
    header: 'Balance',
    cell: (c) => {
      const b = c.getValue()
      return b ? (BUCKET_LABELS[b] ?? humanize(b)) : '—'
    },
  }),
])

export default function TransactionsTable({
  query,
}: {
  query: ReturnType<typeof useTransactionsQuery>
}) {
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  const table = useTable({ features, data: items, columns })

  if (query.isPending) {
    return (
      <div className="grid gap-3" role="status" aria-busy="true" aria-label="Loading transactions">
        <Skeleton className="h-64 rounded-[var(--r)]" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <p className="pt-note pt-note--bad" role="alert">
        Couldn’t load transactions. {query.error.message}
      </p>
    )
  }
  if (items.length === 0) {
    return (
      <div className="pt-empty rounded-xl border bg-card shadow">
        <p className="text-lg font-semibold">No transactions yet</p>
        <p className="pt-fine">Credits you buy and spend will show up here.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
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
  )
}
