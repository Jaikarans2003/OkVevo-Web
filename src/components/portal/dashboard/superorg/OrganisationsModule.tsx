'use client'

/**
 * Super-org › Organisations: health chips + searchable/sortable/keyset
 * Data Table (owner, members, wallet %, used, burn, days left, owes,
 * active), Create dialog, Remove (alert-dialog), Send credits, Export CSV
 * (existing usage export, group_by=org), child detail slide-over.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  columnVisibilityFeature,
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { Download, MoreHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ModulePage from '@/components/portal/ModulePage'
import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { useAuthedQuery } from '@/hooks/useAuthedQuery'
import { cn } from '@/lib/utils'

import { useOrgContext, useOrgInfiniteQuery } from '../org/dashboard-hooks'
import type { ActivityItem, ChildOrgRow, Paged, TransferRow, UsageResult } from '../org/dashboard-types'
import {
  downloadCsv,
  errorText,
  fmtDateTime,
  fmtInt,
  fmtPct,
  localDay,
  rangeForPreset,
  VIEWER_TZ,
} from '../org/dashboard-utils'
import { CHART_COLORS, EmptyState, ErrorNote, KpiCard, PctBar } from '../org/dashboard-parts'
import CreateOrgDialog from './CreateOrgDialog'
import SendCreditsDialog from './SendCreditsDialog'

const HEALTHS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive30', label: 'Inactive 30d' },
  { value: 'low', label: 'Running low' },
  { value: 'overdrawn', label: 'Overdrawn' },
] as const

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'members', label: 'Members' },
  { value: 'walletPct', label: 'Wallet %' },
  { value: 'used', label: 'Credits used' },
  { value: 'burn', label: 'Burn per day' },
  { value: 'daysLeft', label: 'Days left' },
  { value: 'owes', label: 'Owes' },
  { value: 'active', label: 'Active' },
] as const

/* Only column visibility is registered: rows render via row.getVisibleCells().
   Sorting/search/paging stay server-side, so no v9 row-model features are needed. */
const features = tableFeatures({ columnVisibilityFeature })
const columnHelper = createColumnHelper<typeof features, ChildOrgRow>()

export default function OrganisationsModule() {
  const ctx = useOrgContext()
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()

  const [health, setHealth] = useState('')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')
  const [selected, setSelected] = useState<ChildOrgRow | null>(null)
  const [sendTarget, setSendTarget] = useState<ChildOrgRow | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ChildOrgRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const publicId = ctx?.publicId ?? ''
  const orgs = useOrgInfiniteQuery<Paged<ChildOrgRow>>({
    queryKey: ['organisations', { q, sort, health }],
    path: (cursor) => {
      const p = new URLSearchParams({ sort })
      if (q) p.set('q', q)
      if (health) p.set('health', health)
      if (cursor) p.set('cursor', cursor)
      return `/api/orgs/${publicId}/organisations?${p}`
    },
    enabled: !!ctx,
  })

  const remove = useMutation({
    mutationFn: (row: ChildOrgRow) =>
      authedJson(user!, `/api/orgs/${publicId}/organisations/${row.publicId}/remove`, {
        method: 'POST',
        body: '{}',
        org: publicId,
      }),
    onSuccess: () => {
      setRemoveTarget(null)
      if (selected) setSelected(null)
      void queryClient.invalidateQueries({ queryKey: ['organisations'] })
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
      void queryClient.invalidateQueries({ queryKey: ['activity'] })
      void queryClient.invalidateQueries({ queryKey: ['transfers'] })
    },
  })

  const canManage = ctx?.canManage ?? false
  const columns = useMemo(
    () => columnHelper.columns([
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (c) => (
          <button
            type="button"
            className="font-medium underline-offset-4 hover:underline"
            onClick={() => setSelected(c.row.original)}
          >
            {c.getValue()}
          </button>
        ),
      }),
      columnHelper.accessor((r) => r.ownerName ?? r.ownerEmail, {
        id: 'owner',
        header: 'Owner',
        cell: (c) => c.getValue() ?? '—',
      }),
      columnHelper.accessor('memberCount', {
        header: () => <span className="block text-right">Members</span>,
        cell: (c) => <span className="block text-right tabular-nums">{fmtInt(c.getValue())}</span>,
      }),
      columnHelper.accessor('walletPct', {
        header: 'Wallet',
        cell: (c) => (
          <div className="flex w-28 items-center gap-2">
            <PctBar value={c.getValue()} className="w-16" />
            <span className="text-xs tabular-nums">{fmtPct(c.getValue())}</span>
          </div>
        ),
      }),
      columnHelper.accessor('creditsUsed', {
        header: () => <span className="block text-right">Credits used</span>,
        cell: (c) => <span className="block text-right tabular-nums">{fmtInt(c.getValue())}</span>,
      }),
      columnHelper.accessor('burnPerDay', {
        header: () => <span className="block text-right">Burn/day</span>,
        cell: (c) => <span className="block text-right tabular-nums">{fmtInt(c.getValue())}</span>,
      }),
      columnHelper.accessor('daysLeft', {
        header: () => <span className="block text-right">Days left</span>,
        cell: (c) => <span className="block text-right tabular-nums">{c.getValue() != null ? fmtInt(c.getValue()!) : '—'}</span>,
      }),
      columnHelper.accessor('owes', {
        header: () => <span className="block text-right">Owes</span>,
        cell: (c) =>
          c.getValue() > 0 ? (
            <span className="block text-right tabular-nums text-destructive">{fmtInt(c.getValue())}</span>
          ) : (
            <span className="block text-right tabular-nums">0</span>
          ),
      }),
      columnHelper.accessor('active', {
        header: 'Active',
        cell: (c) =>
          c.getValue() ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
      }),
      columnHelper.display({
        id: 'actions',
        cell: (c) => {
          const row = c.row.original
          if (!canManage) return null
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={`Actions for ${row.name}`}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setSelected(row)}>View details</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSendTarget(row)}>Send credits</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setRemoveTarget(row)}>
                  Remove organisation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      }),
    ]),
    [canManage]
  )

  const rows = useMemo(() => orgs.data?.pages.flatMap((p) => p.items) ?? [], [orgs.data])
  const table = useTable({ features, data: rows, columns })

  if (!ctx) return null

  return (
    <ModulePage title="Organisations" placeholder="" queryKey={['organisations']} query={orgs}>
      {orgs.isError ? <ErrorNote error={orgs.error} /> : null}
      {orgs.data ? (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Health filter">
            {HEALTHS.map((h) => (
              <button
                key={h.value}
                type="button"
                aria-pressed={health === h.value}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  health === h.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
                )}
                onClick={() => setHealth(h.value)}
              >
                {h.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Organisation filters">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="orgs-q">
                Search
              </label>
              <Input id="orgs-q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name" className="w-[220px]" />
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground" id="orgs-sort-label">
                Sort by
              </span>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[160px]" aria-labelledby="orgs-sort-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canManage ? <CreateOrgDialog publicId={ctx.publicId} open={createOpen} onOpenChange={setCreateOpen} /> : null}
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent"
              onClick={() => {
                setCsvError(null)
                const range = rangeForPreset('30d')
                const p = new URLSearchParams({
                  from: range.from,
                  to: range.to,
                  tz: VIEWER_TZ,
                  bucket: 'day',
                  group_by: 'org',
                  format: 'csv',
                })
                downloadCsv(user!, `/api/orgs/${ctx.publicId}/usage?${p}`, null, 'organisations-usage.csv').catch((e) =>
                  setCsvError(errorText(e instanceof Error ? e.message : 'request_failed'))
                )
              }}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </button>
          </div>
          {csvError ? <ErrorNote error={csvError} /> : null}
          {remove.isError ? <ErrorNote error={errorText(remove.error.message)} /> : null}

          {rows.length === 0 ? (
            <EmptyState
              title={q || health ? 'No organisations match' : 'No organisations yet'}
              hint={q || health ? undefined : 'Create your first organisation to start funding it.'}
              action={
                !q && !health && canManage ? (
                  <CreateOrgDialog publicId={ctx.publicId} open={createOpen} onOpenChange={setCreateOpen} />
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((hg) => (
                      <TableRow key={hg.id}>
                        {hg.headers.map((h) => (
                          <TableHead key={h.id}>
                            {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {orgs.hasNextPage ? (
                <div>
                  <Button variant="outline" onClick={() => orgs.fetchNextPage()} disabled={orgs.isFetchingNextPage}>
                    {orgs.isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <OrgDetailSheet
        superPublicId={ctx.publicId}
        row={selected}
        canManage={canManage}
        onClose={() => setSelected(null)}
        onSend={(r) => setSendTarget(r)}
      />

      {sendTarget ? (
        <SendCreditsDialog
          publicId={ctx.publicId}
          preselected={sendTarget.publicId}
          preselectedName={sendTarget.name}
          presetAmount={sendTarget.owes > 0 ? sendTarget.owes : undefined}
          open={!!sendTarget}
          onOpenChange={(open) => !open && setSendTarget(null)}
        />
      ) : null}

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The organisation leaves this super-organisation. Its remaining sponsored credits come back to your pool;
              any credits it owes are settled on removal. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) remove.mutate(removeTarget)
              }}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModulePage>
  )
}

/** Child detail slide-over (inherited_read): usage bars, activity, transfers, send credits, owes warning. */
function OrgDetailSheet({
  superPublicId,
  row,
  canManage,
  onClose,
  onSend,
}: {
  superPublicId: string
  row: ChildOrgRow | null
  canManage: boolean
  onClose: () => void
  onSend: (row: ChildOrgRow) => void
}) {
  const range = rangeForPreset('30d')
  const usage = useAuthedQuery<UsageResult>({
    queryKey: ['organisations', 'child', row?.publicId, 'usage'],
    path: row
      ? `/api/orgs/${row.publicId}/usage?${new URLSearchParams({ from: range.from, to: range.to, tz: VIEWER_TZ, bucket: 'day', group_by: 'model' })}`
      : '',
    enabled: !!row,
  })
  const activity = useAuthedQuery<Paged<ActivityItem>>({
    queryKey: ['organisations', 'child', row?.publicId, 'activity'],
    path: row ? `/api/orgs/${row.publicId}/activity` : '',
    enabled: !!row,
  })
  const transfers = useAuthedQuery<Paged<TransferRow>>({
    queryKey: ['organisations', 'child', row?.publicId, 'transfers'],
    path: row ? `/api/orgs/${superPublicId}/transfers?to=${encodeURIComponent(row.publicId)}` : '',
    enabled: !!row,
  })

  const daily = useMemo(() => {
    if (!usage.data) return []
    const map = new Map<string, number>()
    for (const s of usage.data.series) map.set(s.bucket, (map.get(s.bucket) ?? 0) + s.credits)
    return [...map.entries()].map(([day, credits]) => ({ day, credits }))
  }, [usage.data])

  const byModel = useMemo(() => {
    if (!usage.data) return []
    const map = new Map<string, number>()
    for (const s of usage.data.series) {
      const label = usage.data.labels[s.key] ?? s.key
      map.set(label, (map.get(label) ?? 0) + s.credits)
    }
    return [...map.entries()]
      .map(([name, credits]) => ({ name, credits }))
      .sort((a, b) => b.credits - a.credits)
      .slice(0, 10)
  }, [usage.data])

  return (
    <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {row ? (
          <>
            <SheetHeader>
              <SheetTitle>{row.name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {row.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive 30d</Badge>}
                {row.walletPct < 10 ? <Badge variant="destructive">Running low</Badge> : null}
              </div>
            </SheetHeader>

            <div className="mt-6 grid gap-6">
              {row.owes > 0 ? (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  Owes {fmtInt(row.owes)} credits. The next send repays this first.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Wallet" value={fmtPct(row.walletPct)} sub={<PctBar value={row.walletPct} />} />
                <KpiCard
                  label="Days left"
                  value={row.daysLeft != null ? fmtInt(row.daysLeft) : '—'}
                  sub={row.daysLeft == null ? 'No recent burn' : `Burn ${fmtInt(row.burnPerDay)}/day`}
                />
              </div>

              {canManage ? (
                <div>
                  <Button onClick={() => onSend(row)}>Send credits</Button>
                </div>
              ) : null}

              <Tabs defaultValue="usage">
                <TabsList>
                  <TabsTrigger value="usage">Usage</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="transfers">Transfers</TabsTrigger>
                </TabsList>

                <TabsContent value="usage" className="grid gap-4 pt-4">
                  {usage.isError ? <ErrorNote error={usage.error} /> : null}
                  {usage.data ? (
                    daily.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No usage in the last 30 days.</p>
                    ) : (
                      <>
                        <ChartContainer config={{ credits: { label: 'Credits', color: CHART_COLORS[0] } }} className="h-[200px] w-full">
                          <BarChart data={daily} margin={{ left: 8, right: 8, top: 8 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                            <YAxis tickLine={false} axisLine={false} width={44} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="credits" fill="var(--color-credits)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Model</TableHead>
                              <TableHead className="text-right">Credits</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {byModel.map((m) => (
                              <TableRow key={m.name}>
                                <TableCell className="max-w-[220px] truncate">{m.name}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmtInt(m.credits)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>
                    )
                  ) : null}
                </TabsContent>

                <TabsContent value="activity" className="pt-4">
                  {activity.isError ? <ErrorNote error={activity.error} /> : null}
                  {activity.data ? (
                    activity.data.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity yet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Actor</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activity.data.items.slice(0, 10).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="whitespace-nowrap">{fmtDateTime(item.createdAt)}</TableCell>
                              <TableCell className="max-w-[140px] truncate">{item.actor}</TableCell>
                              <TableCell>{item.action}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  ) : null}
                </TabsContent>

                <TabsContent value="transfers" className="pt-4">
                  {transfers.isError ? <ErrorNote error={transfers.error} /> : null}
                  {transfers.data ? (
                    transfers.data.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No transfers yet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead className="text-right">Sent</TableHead>
                            <TableHead className="text-right">Repaid</TableHead>
                            <TableHead className="text-right">Added</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transfers.data.items.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="whitespace-nowrap">{fmtDateTime(t.createdAt)}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmtInt(t.transferred)}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmtInt(t.repaid)}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmtInt(t.added)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
