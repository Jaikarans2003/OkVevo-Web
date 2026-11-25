'use client'

/**
 * Org overview (plan §2):
 *  - owner / inherited_read / platform_admin: badge (Independent | Part of X),
 *    KPI cards (omitted when the API omits the value), top-10 members bars,
 *    30-day credits bars. Polls every 60s.
 *  - member: org name, role + status badges, shared wallet % bars.
 */
import { Building2, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ModulePage from '@/components/portal/ModulePage'
import { useAuthedQuery, useSummary } from '@/hooks/useAuthedQuery'

import type { OrgMemberSelfRow, OrgOverview, OrgWalletPct } from './dashboard-types'
import { fmtInt, fmtPct } from './dashboard-utils'
import { CHART_COLORS, ChartCard, DeltaLabel, EmptyState, ErrorNote, KpiCard, KpiGrid, PctBar } from './dashboard-parts'
import { useOrgContext } from './dashboard-hooks'

export default function OrgOverviewModule() {
  const ctx = useOrgContext()
  if (!ctx) return null
  return ctx.role === 'member' ? <MemberOverview publicId={ctx.publicId} /> : <OwnerOverview publicId={ctx.publicId} />
}

function OwnerOverview({ publicId }: { publicId: string }) {
  const overview = useAuthedQuery<OrgOverview>({
    queryKey: ['overview'],
    path: `/api/orgs/${publicId}/overview`,
    options: { refetchInterval: 60_000 },
  })
  const ctx = useOrgContext()
  const parentName =
    overview.data && typeof overview.data.badge === 'object' ? overview.data.badge.partOf : ctx?.detail.org.parentName

  return (
    <ModulePage title="Overview" placeholder="" queryKey={['overview']} query={overview}>
      {overview.isError ? <ErrorNote error={overview.error} /> : null}
      {overview.data ? (
        <div className="grid gap-6">
          <div className="flex items-center gap-3">
            <Badge variant={typeof overview.data.badge === 'object' ? 'default' : 'secondary'}>
              {typeof overview.data.badge === 'object' ? `Part of ${overview.data.badge.partOf}` : 'Independent'}
            </Badge>
          </div>

          <KpiGrid>
            {overview.data.planPct != null ? (
              <KpiCard label="Plan credits" value={fmtPct(overview.data.planPct)} sub={<PctBar value={overview.data.planPct} />} />
            ) : null}
            {overview.data.additionalPct != null ? (
              <KpiCard label="Additional credits" value={fmtPct(overview.data.additionalPct)} sub={<PctBar value={overview.data.additionalPct} />} />
            ) : null}
            {overview.data.sponsoredPct != null ? (
              <KpiCard
                label={parentName ? `From ${parentName}` : 'From super-organisation'}
                value={fmtPct(overview.data.sponsoredPct)}
                sub={<PctBar value={overview.data.sponsoredPct} />}
              />
            ) : null}
            <KpiCard label="Members" value={fmtInt(overview.data.memberCount)} icon={Users} />
            {overview.data.usedThisPeriod ? (
              <KpiCard
                label="Used this period"
                value={fmtInt(overview.data.usedThisPeriod.credits)}
                sub={
                  <DeltaLabel
                    current={overview.data.usedThisPeriod.credits}
                    previous={overview.data.usedThisPeriod.credits - overview.data.usedThisPeriod.delta}
                  />
                }
              />
            ) : null}
          </KpiGrid>

          {!overview.data.usageLast30Days && !overview.data.top10Members ? (
            <EmptyState title="No usage in the last 30 days" />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {overview.data.usageLast30Days ? (
                <ChartCard title="Credits, last 30 days" caption="(UTC)">
                  <ChartContainer config={{ credits: { label: 'Credits', color: CHART_COLORS[0] } }} className="h-[240px] w-full">
                    <BarChart data={overview.data.usageLast30Days} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tickLine={false} axisLine={false} width={48} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="credits" fill="var(--color-credits)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.data.usageLast30Days.map((d) => (
                        <TableRow key={d.day}>
                          <TableCell>{d.day}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(d.credits)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ChartCard>
              ) : null}
              {overview.data.top10Members ? (
                <ChartCard title="Top members" caption="By credits this period">
                  <ChartContainer config={{ credits: { label: 'Credits', color: CHART_COLORS[0] } }} className="h-[240px] w-full">
                    <BarChart
                      data={overview.data.top10Members.map((m) => ({ name: m.label, credits: m.credits }))}
                      layout="vertical"
                      margin={{ left: 8, right: 16, top: 8 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={130}
                        tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="credits" fill="var(--color-credits)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.data.top10Members.map((m) => (
                        <TableRow key={m.userId}>
                          <TableCell className="max-w-[260px] truncate">{m.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(m.credits)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ChartCard>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </ModulePage>
  )
}

function MemberOverview({ publicId }: { publicId: string }) {
  const summary = useSummary()
  const ctx = useOrgContext()
  const self: OrgMemberSelfRow | undefined = (ctx?.detail.members as OrgMemberSelfRow[] | undefined)?.[0]
  const wallet = ctx?.detail.wallet as OrgWalletPct | null | undefined

  return (
    <ModulePage title="Overview" placeholder="" queryKey={['summary']} query={summary}>
      {summary.isError ? <ErrorNote error={summary.error} /> : null}
      {ctx && summary.data ? (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
              {ctx.detail.org.name}
            </h2>
            <Badge variant="secondary">{ctx.role}</Badge>
            {self?.status ? <Badge variant="outline">{self.status}</Badge> : null}
            {ctx.detail.org.parentName ? <Badge>Part of {ctx.detail.org.parentName}</Badge> : null}
          </div>
          <KpiGrid>
            <KpiCard label="Plan credits" value={fmtPct(summary.data.remainingPct)} sub={<PctBar value={summary.data.remainingPct} />} />
            <KpiCard label="Additional credits" value={fmtPct(summary.data.additionalPct)} sub={<PctBar value={summary.data.additionalPct} />} />
            {summary.data.sponsoredPct > 0 || wallet?.fundedBy ? (
              <KpiCard
                label={wallet?.fundedBy ? `From ${wallet.fundedBy}` : 'From super-organisation'}
                value={fmtPct(summary.data.sponsoredPct)}
                sub={<PctBar value={summary.data.sponsoredPct} />}
              />
            ) : null}
          </KpiGrid>
        </div>
      ) : null}
    </ModulePage>
  )
}
