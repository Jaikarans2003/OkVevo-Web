'use client'

/**
 * Org owner › Members: searchable/sortable/keyset-paged Data Table,
 * member detail slide-over (per-model bars + recent jobs), optimistic role
 * change and remove (owner only), join-code card.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  columnVisibilityFeature,
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'
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
import ModulePage from '@/components/portal/ModulePage'
import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { useAuthedQuery, useMe } from '@/hooks/useAuthedQuery'
import { accountKey, useAccount } from '@/lib/orgs/accountContext'

import { useOrgContext, useOrgInfiniteQuery } from './dashboard-hooks'
import JoinCodeCard from './JoinCodeCard'
import type { JobRow, MemberRow, Paged, UsageResult } from './dashboard-types'
import { errorText, fmtDateTime, fmtInt, localDay, VIEWER_TZ } from './dashboard-utils'
import { CHART_COLORS, EmptyState, ErrorNote, KpiCard } from './dashboard-parts'

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'role', label: 'Role' },
  { value: 'used', label: 'Credits used' },
  { value: 'lastActive', label: 'Last active' },
] as const

/* Only column visibility is registered: rows render via row.getVisibleCells()
   and the actions column sets enableHiding. Sorting/search/paging stay
   server-side, so no v9 row-model features are needed. */
const features = tableFeatures({ columnVisibilityFeature })
const columnHelper = createColumnHelper<typeof features, MemberRow>()

export default function MembersModule() {
  const ctx = useOrgContext()
  const account = useAccount()
  const { user } = usePortalAuth()
  const me = useMe()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<string>('name')
  const [selected, setSelected] = useState<MemberRow | null>(null)
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const publicId = ctx?.publicId ?? ''
  const listParams = useMemo(() => ({ q, sort }), [q, sort])
  const listKey = useMemo(() => ['members', listParams, accountKey(account)] as const, [listParams, account])

  const members = useOrgInfiniteQuery<Paged<MemberRow>>({
    queryKey: ['members', listParams],
    path: (cursor) => {
      const p = new URLSearchParams({ sort })
      if (q) p.set('q', q)
      if (cursor) p.set('cursor', cursor)
      return `/api/orgs/${publicId}/members?${p}`
    },
    enabled: !!ctx,
  })

  type PageData = { pages: Paged<MemberRow>[]; pageParams: unknown[] }
  const patchList = (updater: (row: MemberRow) => MemberRow | null) => {
    queryClient.setQueryData<PageData>(listKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items
                .map((row) => updater(row))
                .filter((row): row is MemberRow => row !== null),
            })),
          }
        : old
    )
  }

  const roleChange = useMutation({
    mutationFn: ({ row, role }: { row: MemberRow; role: string }) =>
      authedJson(user!, `/api/orgs/${publicId}/members/${row.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
        org: publicId,
      }),
    onMutate: async ({ row, role }) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData(listKey)
      patchList((r) => (r.userId === row.userId ? { ...r, role } : r))
      if (selected?.userId === row.userId) setSelected({ ...selected, role })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] })
      void queryClient.invalidateQueries({ queryKey: ['org'] })
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
  })

  const removeMember = useMutation({
    mutationFn: (row: MemberRow) =>
      authedJson(user!, `/api/orgs/${publicId}/members/${row.userId}`, { method: 'DELETE', org: publicId }),
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData(listKey)
      patchList((r) => (r.userId === row.userId ? null : r))
      if (selected?.userId === row.userId) setSelected(null)
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] })
      void queryClient.invalidateQueries({ queryKey: ['org'] })
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
  })

  const columns = useMemo(
    () => columnHelper.columns([
      columnHelper.accessor((r) => r.name ?? r.email ?? r.userId, {
        id: 'name',
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
      columnHelper.accessor('email', { header: 'Email', cell: (c) => c.getValue() ?? '—' }),
      columnHelper.accessor('role', {
        header: 'Role',
        cell: (c) => <Badge variant={c.getValue() === 'owner' ? 'default' : 'secondary'}>{c.getValue()}</Badge>,
      }),
      columnHelper.accessor('creditsUsed', {
        header: () => <span className="block text-right">Credits used</span>,
        cell: (c) => <span className="block text-right tabular-nums">{fmtInt(c.getValue())}</span>,
      }),
      columnHelper.accessor('lastActive', {
        header: 'Last active',
        cell: (c) => fmtDateTime(c.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        enableHiding: false,
        cell: (c) => {
          const row = c.row.original
          if (!ctx?.canManage || row.userId === me.data?.user.id) return null
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={`Actions for ${row.name ?? row.email ?? 'member'}`}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setSelected(row)}>View details</DropdownMenuItem>
                {row.role !== 'admin' ? (
                  <DropdownMenuItem
                    onSelect={() => roleChange.mutate({ row, role: row.role === 'owner' ? 'member' : 'owner' })}
                  >
                    {row.role === 'owner' ? 'Change to member' : 'Make owner'}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setRemoveTarget(row)}
                >
                  Remove from organisation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      }),
    ]),
    [ctx?.canManage, me.data?.user.id, roleChange, selected]
  )

  const rows = useMemo(() => members.data?.pages.flatMap((p) => p.items) ?? [], [members.data])
  const table = useTable({ features, data: rows, columns })

  if (!ctx) return null

  return (
    <ModulePage title="Members" placeholder="" queryKey={['members']} query={members}>
      {members.isError ? <ErrorNote error={members.error} /> : null}
      {members.data ? (
        <div className="grid gap-6">
          {ctx.canManage ? (
            <JoinCodeCard publicId={ctx.publicId} scopeKey="members" />
          ) : null}

          <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Member filters">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="members-q">
                Search
              </label>
              <Input
                id="members-q"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or email"
                className="w-[220px]"
              />
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground" id="members-sort-label">
                Sort by
              </span>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[160px]" aria-labelledby="members-sort-label">
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
          </div>

          {roleChange.isError ? <ErrorNote error={errorText(roleChange.error.message)} /> : null}
          {removeMember.isError ? <ErrorNote error={errorText(removeMember.error.message)} /> : null}

          {rows.length === 0 ? (
            <EmptyState
              title={q ? 'No members match that search' : 'Only you so far'}
              hint={q ? undefined : 'Share the join code above to add people.'}
            />
          ) : (
            <>
              <div className="rounded-md border">
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
              {members.hasNextPage ? (
                <div>
                  <Button variant="outline" onClick={() => members.fetchNextPage()} disabled={members.isFetchingNextPage}>
                    {members.isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <MemberSheet
        publicId={ctx.publicId}
        member={selected}
        canManage={ctx.canManage}
        isSelf={selected?.userId === me.data?.user.id}
        onClose={() => setSelected(null)}
        onRoleChange={(row, role) => roleChange.mutate({ row, role })}
        onRemove={(row) => setRemoveTarget(row)}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name ?? removeTarget?.email ?? 'this member'}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to this organisation and its credits. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) removeMember.mutate(removeTarget)
                setRemoveTarget(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModulePage>
  )
}

/** Member detail slide-over: stats, per-model bars (30d), recent jobs. */
function MemberSheet({
  publicId,
  member,
  canManage,
  isSelf,
  onClose,
  onRoleChange,
  onRemove,
}: {
  publicId: string
  member: MemberRow | null
  canManage: boolean
  isSelf: boolean
  onClose: () => void
  onRoleChange: (row: MemberRow, role: string) => void
  onRemove: (row: MemberRow) => void
}) {
  const from = localDay(new Date(Date.now() - 29 * 864e5))
  const to = localDay(new Date())
  const usage = useAuthedQuery<UsageResult>({
    queryKey: ['members', 'detail-usage', member?.userId],
    path: member
      ? `/api/orgs/${publicId}/usage?${new URLSearchParams({ from, to, tz: VIEWER_TZ, bucket: 'day', group_by: 'model', member: member.userId })}`
      : '',
    enabled: !!member,
  })
  const jobs = useAuthedQuery<Paged<JobRow>>({
    queryKey: ['members', 'detail-jobs', member?.userId],
    path: member ? `/api/orgs/${publicId}/jobs?${new URLSearchParams({ member: member.userId, limit: '10' })}` : '',
    enabled: !!member,
  })

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
  }, [usage.data])

  return (
    <Sheet open={!!member} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {member ? (
          <>
            <SheetHeader>
              <SheetTitle>{member.name ?? member.email ?? member.userId}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>{member.role}</Badge>
                <Badge variant="outline">{member.status}</Badge>
              </div>
              {member.email && member.name ? <p className="text-sm text-muted-foreground">{member.email}</p> : null}
            </SheetHeader>

            <div className="mt-6 grid gap-6">
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Credits used this period" value={fmtInt(member.creditsUsed)} />
                <KpiCard label="Last active" value={<span className="text-base">{fmtDateTime(member.lastActive)}</span>} />
              </div>

              {canManage && !isSelf ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground" id="ms-role-label">
                      Role
                    </span>
                    {member.role === 'admin' ? (
                      <Badge variant="outline">admin</Badge>
                    ) : (
                      <Select value={member.role} onValueChange={(role) => onRoleChange(member, role)}>
                        <SelectTrigger className="w-[150px]" aria-labelledby="ms-role-label">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button variant="outline" className="text-destructive" onClick={() => onRemove(member)}>
                    Remove from organisation
                  </Button>
                </div>
              ) : null}

              <section className="grid gap-2" aria-label="Credits by model, last 30 days">
                <h3 className="text-sm font-medium">Credits by model, last 30 days</h3>
                {usage.isError ? <ErrorNote error={usage.error} /> : null}
                {usage.data ? (
                  byModel.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No usage in the last 30 days.</p>
                  ) : (
                    <>
                      <ChartContainer config={{ credits: { label: 'Credits', color: CHART_COLORS[0] } }} className="h-[200px] w-full">
                        <BarChart data={byModel} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
                          <CartesianGrid horizontal={false} />
                          <XAxis type="number" tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120}
                            tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="credits" fill="var(--color-credits)" radius={[0, 4, 4, 0]} />
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
              </section>

              <section className="grid gap-2" aria-label="Recent activity">
                <h3 className="text-sm font-medium">Recent activity</h3>
                {jobs.isError ? <ErrorNote error={jobs.error} /> : null}
                {jobs.data ? (
                  jobs.data.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No jobs yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Job type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.data.items.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="whitespace-nowrap">{fmtDateTime(job.createdAt)}</TableCell>
                            <TableCell className="max-w-[140px] truncate">{job.modelLabel}</TableCell>
                            <TableCell>{job.jobType}</TableCell>
                            <TableCell>{job.status}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtInt(job.credits)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                ) : null}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
