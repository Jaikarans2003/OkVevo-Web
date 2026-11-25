'use client'

/**
 * Super-org › Credits: pool cards (pool %, available to send, sent this
 * month, owed), owed list with settle action (pre-filled Send credits),
 * and the transfers ledger.
 */
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ModulePage from '@/components/portal/ModulePage'
import { useAuthedQuery } from '@/hooks/useAuthedQuery'

import { useOrgContext, useOrgInfiniteQuery } from '../org/dashboard-hooks'
import type { ChildOrgRow, OrgOverview, Paged, TransferRow } from '../org/dashboard-types'
import { errorText, fmtDateTime, fmtInt, fmtPct } from '../org/dashboard-utils'
import { EmptyState, ErrorNote, KpiCard, KpiGrid, PctBar } from '../org/dashboard-parts'
import SendCreditsDialog from './SendCreditsDialog'

export default function CreditsModule() {
  const ctx = useOrgContext()
  const publicId = ctx?.publicId ?? ''
  const [sendOpen, setSendOpen] = useState(false)
  const [settleTarget, setSettleTarget] = useState<ChildOrgRow | null>(null)

  const overview = useAuthedQuery<OrgOverview>({
    queryKey: ['overview'],
    path: `/api/orgs/${publicId}/overview`,
    enabled: !!ctx,
  })
  const owed = useAuthedQuery<Paged<ChildOrgRow>>({
    queryKey: ['organisations', 'owed'],
    path: `/api/orgs/${publicId}/organisations?${new URLSearchParams({ health: 'overdrawn', sort: 'owes' })}`,
    enabled: !!ctx,
  })
  const transfers = useOrgInfiniteQuery<Paged<TransferRow>>({
    queryKey: ['transfers'],
    path: (cursor) => `/api/orgs/${publicId}/transfers${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    enabled: !!ctx,
  })

  if (!ctx) return null

  const o = overview.data

  return (
    <ModulePage title="Credits" placeholder="" queryKey={['transfers', 'overview', 'organisations']} query={overview}>
      {overview.isError ? <ErrorNote error={overview.error} /> : null}
      {o ? (
        <div className="grid gap-8">
          <KpiGrid>
            <KpiCard
              label="Pool"
              value={o.poolPct != null ? fmtPct(o.poolPct) : '—'}
              sub={o.poolPct != null ? <PctBar value={o.poolPct} label="Pool" /> : undefined}
            />
            <KpiCard label="Available to send" value={o.availableToSend != null ? fmtInt(o.availableToSend) : '—'} />
            <KpiCard label="Sent this month" value={o.sentThisMonth != null ? fmtInt(o.sentThisMonth) : '—'} />
            <KpiCard label="Owed back" value={o.owed != null ? fmtInt(o.owed) : '—'} />
          </KpiGrid>

          <section className="grid gap-3" role="region" aria-label="Owed credits">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Owed by organisations</h2>
              {ctx.canManage ? <Button onClick={() => setSendOpen(true)}>Send credits</Button> : null}
            </div>
            {owed.isError ? <ErrorNote error={owed.error} /> : null}
            {owed.data ? (
              owed.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No organisation owes credits.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organisation</TableHead>
                      <TableHead className="text-right">Owes</TableHead>
                      {ctx.canManage ? <TableHead className="w-[120px]" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {owed.data.items.map((row) => (
                      <TableRow key={row.publicId}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{fmtInt(row.owes)}</TableCell>
                        {ctx.canManage ? (
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setSettleTarget(row)}>
                              Settle
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : null}
          </section>

          <section className="grid gap-3" role="region" aria-label="Transfers">
            <h2 className="text-sm font-medium">Transfers</h2>
            {transfers.isError ? <ErrorNote error={errorText('request_failed')} /> : null}
            {transfers.data ? (
              transfers.data.pages.every((p) => p.items.length === 0) ? (
                <EmptyState title="No transfers yet" hint="Credits you send to organisations appear here." />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Repaid</TableHead>
                        <TableHead className="text-right">Added</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.data.pages.flatMap((p) => p.items).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="whitespace-nowrap">{fmtDateTime(t.createdAt)}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{t.childName ?? t.childPublicId ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(t.transferred)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(t.repaid)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(t.added)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {transfers.hasNextPage ? (
                    <div>
                      <Button variant="outline" onClick={() => transfers.fetchNextPage()} disabled={transfers.isFetchingNextPage}>
                        {transfers.isFetchingNextPage ? 'Loading…' : 'Load more'}
                      </Button>
                    </div>
                  ) : null}
                </>
              )
            ) : null}
          </section>
        </div>
      ) : null}

      <SendCreditsDialog publicId={ctx.publicId} open={sendOpen} onOpenChange={setSendOpen} />
      {settleTarget ? (
        <SendCreditsDialog
          publicId={ctx.publicId}
          preselected={settleTarget.publicId}
          preselectedName={settleTarget.name}
          presetAmount={settleTarget.owes}
          open={!!settleTarget}
          onOpenChange={(open) => !open && setSettleTarget(null)}
        />
      ) : null}
    </ModulePage>
  )
}
