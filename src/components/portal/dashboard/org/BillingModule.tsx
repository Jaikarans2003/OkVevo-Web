'use client'

/**
 * Org wallet › Billing: Transactions · Credits · Payments tabs (owner-only
 * exact credits, enforced by the API). Child (prepaid) orgs see the
 * "Funded by {super-org}" note instead of purchase affordances.
 * Deep links /billing/{credits,payments,transactions} preselect the tab.
 */
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ModulePage from '@/components/portal/ModulePage'
import { useAuthedQuery, useOrgDetail, useSummary } from '@/hooks/useAuthedQuery'

import { useOrgContext, useOrgInfiniteQuery } from './dashboard-hooks'
import type { CreditsHealth, LedgerItem, Paged, PaymentsPage } from './dashboard-types'
import { errorText, fmtDate, fmtDateTime, fmtInt, fmtPct } from './dashboard-utils'
import { EmptyState, ErrorNote, KpiCard, PctBar } from './dashboard-parts'

const TABS = ['transactions', 'credits', 'payments'] as const
type BillingTab = (typeof TABS)[number]

export default function OrgBillingModule() {
  const ctx = useOrgContext()
  const detail = useOrgDetail(ctx?.publicId ?? null)
  const params = useParams<{ slug?: string[] }>()
  const slug = params.slug?.[0]
  const initial: BillingTab = (TABS as readonly string[]).includes(slug ?? '') ? (slug as BillingTab) : 'transactions'
  const [tab, setTab] = useState<BillingTab>(initial)
  const summary = useSummary()

  if (!ctx) return null
  const fundedBy = summary.data?.fundedBy ?? null
  const canPurchase = summary.data?.canPurchase ?? true

  return (
    <ModulePage title="Billing" placeholder="" queryKey={[tab]} query={detail}>
      <div className="grid gap-6">
        {fundedBy && !canPurchase ? (
          <p className="text-sm text-muted-foreground">
            Funded by {fundedBy}. Top-ups and plan changes are handled by your super-organisation.
          </p>
        ) : null}
        <Tabs value={tab} onValueChange={(v) => setTab(v as BillingTab)}>
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="transactions" className="pt-6">
            <TransactionsTab />
          </TabsContent>
          <TabsContent value="credits" className="pt-6">
            <CreditsTab />
          </TabsContent>
          <TabsContent value="payments" className="pt-6">
            <PaymentsTab />
          </TabsContent>
        </Tabs>
      </div>
    </ModulePage>
  )
}

function TransactionsTab() {
  const txns = useOrgInfiniteQuery<Paged<LedgerItem>>({
    queryKey: ['transactions'],
    path: (cursor) => `/api/billing/transactions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  })

  if (txns.isError) return <ErrorNote error={txns.error} />
  const rows = txns.data?.pages.flatMap((p) => p.items) ?? []
  if (txns.isPending) {
    return <div className="h-72 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Loading transactions" />
  }
  if (rows.length === 0) return <EmptyState title="No transactions yet" />

  const signed = (row: LedgerItem): number =>
    row.type === 'debit' || row.type === 'transfer_out' ? -row.amount : row.amount

  return (
    <div className="grid gap-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Credits</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">{fmtDateTime(row.createdAt)}</TableCell>
                <TableCell>{row.type.replace(/_/g, ' ')}</TableCell>
                <TableCell>{row.bucket ? row.bucket.replace(/_/g, ' ') : '—'}</TableCell>
                <TableCell className="max-w-[200px] truncate">{row.modelLabel || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(signed(row))}</TableCell>
                <TableCell className="max-w-[200px] truncate">{row.reason ? row.reason.replace(/_/g, ' ') : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {txns.hasNextPage ? (
        <div>
          <Button variant="outline" onClick={() => txns.fetchNextPage()} disabled={txns.isFetchingNextPage}>
            {txns.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function CreditsTab() {
  const credits = useAuthedQuery<CreditsHealth>({ queryKey: ['credits'], path: '/api/billing/credits' })

  if (credits.isError) {
    return (
      <EmptyState
        title="Credits health is owner-only"
        hint={errorText(credits.error.message)}
      />
    )
  }
  if (credits.isPending) {
    return <div className="h-72 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Loading credits" />
  }
  if (!credits.data) return null
  const { buckets, burn, forecastDays } = credits.data

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {buckets.map((b) => (
          <Card key={b.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{b.label}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <div className="text-2xl font-semibold tabular-nums">{fmtPct(b.remainingPct)}</div>
              <PctBar value={b.remainingPct} />
              {b.expiresAt ? (
                <p className="text-xs text-muted-foreground">Soonest expiry {fmtDate(b.expiresAt)} (UTC)</p>
              ) : null}
              {b.expiry.next30 + b.expiry.days31to60 + b.expiry.days61to90 > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Expiring: {fmtInt(b.expiry.next30)} in 30d · {fmtInt(b.expiry.days31to60)} in 31–60d ·{' '}
                  {fmtInt(b.expiry.days61to90)} in 61–90d
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Burn per day (7d avg)" value={fmtInt(burn.perDay7)} />
        <KpiCard label="Burn per day (30d avg)" value={fmtInt(burn.perDay30)} />
        {forecastDays != null ? (
          <KpiCard
            label="Forecast"
            value={`About ${fmtInt(forecastDays)} days`}
            sub="Estimate, based on the last 30 days"
          />
        ) : null}
      </div>
    </div>
  )
}

function PaymentsTab() {
  const payments = useOrgInfiniteQuery<PaymentsPage>({
    queryKey: ['payments'],
    path: (cursor) => `/api/billing/payments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  })

  if (payments.isError) {
    return <EmptyState title="Payments are owner-only" hint={errorText(payments.error.message)} />
  }
  const header = payments.data?.pages[0]?.header
  const rows = payments.data?.pages.flatMap((p) => p.items) ?? []
  if (payments.isPending) {
    return <div className="h-72 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Loading payments" />
  }

  return (
    <div className="grid gap-4">
      {header ? (
        <p className="text-sm text-muted-foreground">
          {header.status ? `Subscription ${header.status}` : null}
          {header.status && header.line ? ' · ' : null}
          {header.line ? `${header.line} (UTC)` : null}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No payments yet" />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Razorpay id</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(row.date)}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.plan ?? '—'}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs">{row.razorpayId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {payments.hasNextPage ? (
            <div>
              <Button variant="outline" onClick={() => payments.fetchNextPage()} disabled={payments.isFetchingNextPage}>
                {payments.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
