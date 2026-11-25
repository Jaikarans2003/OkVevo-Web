'use client'

/**
 * Super-org › Usage (Usage · Jobs tabs). Aggregate across children via
 * group_by=org (UsageView 'super' variant). Tab bodies own their queries;
 * ModulePage gates on the (cached) org detail so there is no double fetch.
 */
import { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ModulePage from '@/components/portal/ModulePage'
import { useOrgDetail } from '@/hooks/useAuthedQuery'

import { useOrgContext } from '../org/dashboard-hooks'
import JobsLog from '../org/JobsLog'
import UsageView from '../org/UsageView'

export default function SuperUsageModule() {
  const ctx = useOrgContext()
  const detail = useOrgDetail(ctx?.publicId ?? null)
  const [tab, setTab] = useState('usage')

  if (!ctx) return null
  return (
    <ModulePage title="Usage" placeholder="" queryKey={[tab]} query={detail}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>
        <TabsContent value="usage" className="pt-6">
          <UsageView publicId={ctx.publicId} variant="super" />
        </TabsContent>
        <TabsContent value="jobs" className="pt-6">
          <JobsLog publicId={ctx.publicId} variant="super" />
        </TabsContent>
      </Tabs>
    </ModulePage>
  )
}
