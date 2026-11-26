'use client'

/**
 * Super-org › Overview: KPIs (Organisations, Active 30d, Pool %, Available
 * to send, Sent this month, Owed — cards render only when the API returns
 * them), top 5 orgs bars, credits sent vs used by month, usage trend.
 * Polls every 60s.
 */
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ModulePage from '@/components/portal/ModulePage'
import { useAuthedQuery } from '@/hooks/useAuthedQuery'

import { useOrgContext } from '../org/dashboard-hooks'
import type { OrgOverview } from '../org/dashboard-types'
import { fmtInt, fmtPct } from '../org/dashboard-utils'
import { CHART_COLORS, ChartCard, EmptyState, ErrorNote, KpiCard, KpiGrid, PctBar } from '../org/dashboard-parts'
import CreateOrgDialog from './CreateOrgDialog'

export default function SuperOrgOverviewModule() {
  const ctx = useOrgContext()
  const [createOpen, setCreateOpen] = useState(false)
  const overview = useAuthedQuery<OrgOverview>({
    queryKey: ['overview'],
    path: `/api/orgs/${ctx?.publicId ?? ''}/overview`,
    enabled: !!ctx,
    options: { refetchInterval: 60_000 },
  })

  if (!ctx) return null
  const data = overview.data

  return (
    <ModulePage title="Overview" placeholder="" queryKey={['overview']} query={overview}>
      {overview.isError ? <ErrorNote error={overview.error} /> : null}
      {data ? (
        <div className="grid gap-6">
          <KpiGrid>
            {data.organisationsCount != null ? <KpiCard label="Organisations" value={fmtInt(data.organisationsCount)} /> : null}
            {data.activeOrgs30d != null ? <KpiCard label="Active in the last 30 days" value={fmtInt(data.activeOrgs30d)} /> : null}
            {data.poolPct != null ? (
              <KpiCard label="Credit pool" value={fmtPct(data.poolPct)} sub={<PctBar value={data.poolPct} label="Credit pool" />} />
            ) : null}
            {data.availableToSend != null ? <KpiCard label="Available to send" value={fmtInt(data.availableToSend)} /> : null}
            {data.sentThisMonth != null ? <KpiCard label="Sent this month" value={fmtInt(data.sentThisMonth)} /> : null}
            {data.owed != null && data.owed > 0 ? <KpiCard label="Owed to you" value={fmtInt(data.owed)} /> : null}
          </KpiGrid>

          {data.organisationsCount === 0 ? (
            <EmptyState
              title="No organisations yet"
              hint="Create your first organisation to start funding it."
              action={<CreateOrgDialog publicId={ctx.publicId} open={createOpen} onOpenChange={setCreateOpen} />}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {data.top5Orgs ? (
                <ChartCard title="Top 5 organisations" caption="By credits used this period">
                  <ChartContainer config={{ credits: { label: 'Credits', color: CHART_COLORS[0] } }} className="h-[240px] w-full">
                    <BarChart data={data.top5Orgs.map((o) => ({ name: o.name, credits: o.credits }))} layout="vertical"
                      margin={{ left: 8, right: 16, top: 8 }}>
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
                        <TableHead>Organisation</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top5Orgs.map((o) => (
                        <TableRow key={o.publicId}>
                          <TableCell className="max-w-[260px] truncate">{o.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(o.credits)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ChartCard>
              ) : null}

              {data.sentVsUsedByMonth ? (
                <ChartCard title="Credits sent vs used" caption="Per month, last 6 months (UTC)">
                  <ChartContainer
                    config={{
                      sent: { label: 'Sent', color: CHART_COLORS[0] },
                      used: { label: 'Used', color: CHART_COLORS[1] },
                    }}
                    className="h-[240px] w-full"
                  >
                    <BarChart data={data.sentVsUsedByMonth} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={48} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="sent" fill="var(--color-sent)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="used" fill="var(--color-used)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sentVsUsedByMonth.map((m) => (
                        <TableRow key={m.month}>
                          <TableCell>{m.month}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(m.sent)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(m.used)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ChartCard>
              ) : null}

              {data.usageTrend ? (
                <ChartCard title="Usage across organisations" caption="Credits per day, last 30 days (UTC)">
                  <ChartContainer config={{ credits: { label: 'Credits', color: CHART_COLORS[0] } }} className="h-[240px] w-full">
                    <BarChart data={data.usageTrend} margin={{ left: 8, right: 8, top: 8 }}>
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
                      {data.usageTrend.map((d) => (
                        <TableRow key={d.day}>
                          <TableCell>{d.day}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(d.credits)}</TableCell>
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
