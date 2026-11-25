'use client'

/**
 * Personal Organisations module: the caller's memberships from /api/me with
 * a per-row shared-credits read from /api/orgs/:id. Row click (or the name
 * link) opens that account at /dashboard/o/{publicId}.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import ModulePage from '@/components/portal/ModulePage'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { queryKeys, useMe, useOrgDetail } from '@/hooks/useAuthedQuery'
import type { MePayload } from '@/lib/api/me'
import { formatPctLabel } from '@/types/credits'

function orgPath(publicId: string): string {
  return `/dashboard/o/${publicId}`
}

/** Shared wallet %s for one membership row (owner read of /api/orgs/:id). */
function SharedCreditsCell({ publicId }: { publicId: string }) {
  const detail = useOrgDetail(publicId)
  const wallet = detail.data?.wallet as
    | { remainingPct?: number; additionalPct?: number; sponsoredPct?: number }
    | null
    | undefined

  if (detail.isPending) return <span className="pt-fine">…</span>
  if (!wallet) return <span className="pt-fine">—</span>
  const parts = [`Plan ${formatPctLabel(wallet.remainingPct ?? 0)}`]
  if ((wallet.additionalPct ?? 0) > 0) parts.push(`Additional ${formatPctLabel(wallet.additionalPct!)}`)
  if ((wallet.sponsoredPct ?? 0) > 0) parts.push(`Sponsored ${formatPctLabel(wallet.sponsoredPct!)}`)
  return <span className="tabular-nums">{parts.join(' · ')}</span>
}

export default function PersonalOrganisations() {
  const router = useRouter()
  const me = useMe()
  const memberships: MePayload['memberships'] = me.data?.memberships ?? []

  return (
    <ModulePage
      title="Organisations"
      placeholder="Organisations module lands in the next wave."
      queryKey={queryKeys.me}
      query={me}
    >
      {me.isError ? (
        <p className="pt-note pt-note--bad" role="alert">
          Couldn’t load your organisations. {me.error.message}
        </p>
      ) : memberships.length === 0 ? (
        <div className="pt-empty rounded-xl border bg-card shadow">
          <p className="text-lg font-semibold">You’re not in an organisation</p>
          <p className="pt-fine">
            When you join or create one, it shows up here and in the account switcher.
          </p>
          <Link className="btn" href="/dashboard/personal/account-type">
            See account types
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Shared credits</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((m) => (
                <TableRow
                  key={m.orgPublicId}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${m.name}`}
                  className="cursor-pointer"
                  onClick={() => router.push(orgPath(m.orgPublicId))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(orgPath(m.orgPublicId))
                    }
                  }}
                >
                  <TableCell>
                    <Link
                      href={orgPath(m.orgPublicId)}
                      className="font-medium underline-offset-4 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.name}
                    </Link>
                    <p className="pt-fine">
                      {m.kind === 'super_org' ? 'Super-organisation' : 'Organisation'}
                      {m.parent ? ` · Part of ${m.parent}` : ''}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                      {m.role === 'owner' ? 'Owner' : 'Member'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SharedCreditsCell publicId={m.orgPublicId} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Active</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ModulePage>
  )
}
