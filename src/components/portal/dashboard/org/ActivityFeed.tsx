'use client'

/**
 * Settings › Activity: the org's audit feed (customer wording from the API).
 * Super-org feeds include children's events with the organisation name.
 */
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { useOrgInfiniteQuery } from './dashboard-hooks'
import type { ActivityItem, Paged } from './dashboard-types'
import { fmtDateTime } from './dashboard-utils'
import { EmptyState, ErrorNote } from './dashboard-parts'

export default function ActivityFeed({
  publicId,
  showOrgName = false,
}: {
  publicId: string
  /** Super-org: show which organisation each event belongs to. */
  showOrgName?: boolean
}) {
  const activity = useOrgInfiniteQuery<Paged<ActivityItem>>({
    queryKey: ['activity'],
    path: (cursor) => `/api/orgs/${publicId}/activity${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  })

  if (activity.isError) return <ErrorNote error={activity.error} />
  const rows = activity.data?.pages.flatMap((p) => p.items) ?? []

  if (!activity.isPending && rows.length === 0) {
    return <EmptyState title="No activity yet" />
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              {showOrgName ? <TableHead>Organisation</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">{fmtDateTime(item.createdAt)}</TableCell>
                <TableCell className="max-w-[180px] truncate">{item.actor}</TableCell>
                <TableCell>{item.action}</TableCell>
                {showOrgName ? <TableCell className="max-w-[180px] truncate">{item.orgName}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {activity.hasNextPage ? (
        <div>
          <Button variant="outline" onClick={() => activity.fetchNextPage()} disabled={activity.isFetchingNextPage}>
            {activity.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
