'use client'

/**
 * Org owner › Usage (Usage · Jobs tabs) and org member › My usage.
 * Owner gets the member filter + top members; the member's rows are
 * server-scoped to their own (user_id = me). Tab bodies own their queries;
 * ModulePage gates on the (cached) org detail so there is no double fetch.
 */
import { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ModulePage from '@/components/portal/ModulePage'
import { useOrgDetail } from '@/hooks/useAuthedQuery'

import { useOrgContext, useOrgInfiniteQuery } from './dashboard-hooks'
import JobsLog from './JobsLog'
import UsageView from './UsageView'
import type { MemberRow, Paged } from './dashboard-types'

/** First members page — options for the member filter and uid → name map. */
function useMemberOptions(publicId: string, enabled: boolean) {
  return useOrgInfiniteQuery<Paged<MemberRow>>({
    queryKey: ['members', 'options'],
    path: () => `/api/orgs/${publicId}/members?sort=name`,
    enabled,
  })
}

export function OrgUsageModule() {
  const ctx = useOrgContext()
  const detail = useOrgDetail(ctx?.publicId ?? null)
  const [tab, setTab] = useState('usage')
  const members = useMemberOptions(ctx?.publicId ?? '', !!ctx && ctx.role !== 'member')
  const memberRows = members.data?.pages[0]?.items

  if (!ctx) return null
  return (
    <ModulePage title="Usage" placeholder="" queryKey={[tab]} query={detail}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>
        <TabsContent value="usage" className="pt-6">
          <UsageView publicId={ctx.publicId} variant="owner" members={memberRows} />
        </TabsContent>
        <TabsContent value="jobs" className="pt-6">
          <JobsLog publicId={ctx.publicId} variant="owner" members={memberRows} />
        </TabsContent>
      </Tabs>
    </ModulePage>
  )
}

export function OrgMyUsageModule() {
  const ctx = useOrgContext()
  const detail = useOrgDetail(ctx?.publicId ?? null)
  const [tab, setTab] = useState('usage')

  if (!ctx) return null
  return (
    <ModulePage title="My usage" placeholder="" queryKey={[tab]} query={detail}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>
        <TabsContent value="usage" className="pt-6">
          <UsageView publicId={ctx.publicId} variant="member" />
        </TabsContent>
        <TabsContent value="jobs" className="pt-6">
          <JobsLog publicId={ctx.publicId} variant="member" />
        </TabsContent>
      </Tabs>
    </ModulePage>
  )
}
