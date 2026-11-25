'use client'

/**
 * Personal Organisations module: the caller's memberships from /api/me with
 * a per-row shared-credits read from /api/orgs/:id, a Join-with-code card,
 * and per-row Switch (open that account) / Leave (confirm, self-leave)
 * actions. Row click (or the name link) opens that account at
 * /dashboard/o/{publicId}.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import ModulePage from '@/components/portal/ModulePage'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { queryKeys, useMe, useOrgDetail } from '@/hooks/useAuthedQuery'
import type { MeMembership, MePayload } from '@/lib/api/me'
import { formatPctLabel } from '@/types/credits'

import { mutationInlineError, useLeaveMembership } from './actions'
import JoinWithCodeCard from './JoinWithCodeCard'

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
  const [leaveTarget, setLeaveTarget] = useState<MeMembership | null>(null)

  const leave = useLeaveMembership()
  const leaveError = mutationInlineError(leave.error)

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
      ) : (
        <div className="grid gap-6">
          {leaveError ? (
            <p className="pt-note pt-note--bad" role="alert">
              {leaveError}
            </p>
          ) : null}

          <JoinWithCodeCard
            title="Join with code"
            description="Paste a join code from any organisation to become a member."
          />

          {memberships.length === 0 ? (
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
                    <TableHead>Actions</TableHead>
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
                      <TableCell>
                        <div
                          className="flex flex-wrap items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Button variant="outline" size="sm" asChild>
                            <Link href={orgPath(m.orgPublicId)}>Switch</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setLeaveTarget(m)}
                          >
                            Leave
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={leaveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {leaveTarget?.name ?? 'this organisation'}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will immediately lose access to this organisation and its shared credits. This
              can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leaveTarget) leave.mutate(leaveTarget.orgPublicId)
              }}
              disabled={leave.isPending}
            >
              {leave.isPending ? 'Leaving…' : 'Leave organisation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModulePage>
  )
}
