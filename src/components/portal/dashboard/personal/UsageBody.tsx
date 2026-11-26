'use client'

/**
 * Personal Usage module: tabs Usage (explore: filters, KPIs, bars, CSV) and
 * Jobs (the jobs log). Refresh invalidates every query under the module's
 * usage base key; the header tracks the active tab's query.
 */
import { useState } from 'react'

import ModulePage from '@/components/portal/ModulePage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { queryKeys } from '@/hooks/useAuthedQuery'
import { useAccount } from '@/lib/orgs/accountContext'

import JobsTable, { useJobsExplore } from './JobsTable'
import UsageExplore, { useUsageExplore } from './UsageExplore'

export default function PersonalUsage() {
  const account = useAccount()
  const base = queryKeys.usage(account)
  const explore = useUsageExplore([...base, 'explore'])
  const jobs = useJobsExplore([...base, 'jobs'])
  const [tab, setTab] = useState<'usage' | 'jobs'>('usage')

  return (
    <ModulePage
      title="Usage"
      placeholder="Usage module lands in the next wave."
      queryKey={base}
      query={tab === 'usage' ? explore.query : jobs.query}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'usage' | 'jobs')}>
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>
        <TabsContent value="usage" className="pt-6">
          <UsageExplore state={explore} />
        </TabsContent>
        <TabsContent value="jobs" className="pt-6">
          <JobsTable state={jobs} />
        </TabsContent>
      </Tabs>
    </ModulePage>
  )
}
