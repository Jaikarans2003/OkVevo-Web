'use client'

/**
 * Org member › Organisation: read-only org card (name, ID, kind, parent,
 * your role/status) + Leave organisation (alert-dialog). Fields the API
 * omits for members (owner name, member count) are simply not rendered.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ModulePage from '@/components/portal/ModulePage'
import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { useOrgDetail } from '@/hooks/useAuthedQuery'

import { useOrgContext } from './dashboard-hooks'
import type { OrgMemberSelfRow } from './dashboard-types'
import { errorText, fmtDate } from './dashboard-utils'
import { ErrorNote } from './dashboard-parts'

export default function OrganisationModule() {
  const ctx = useOrgContext()
  const detail = useOrgDetail(ctx?.publicId ?? null)
  const { user } = usePortalAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const leave = useMutation({
    mutationFn: () =>
      authedJson(user!, `/api/orgs/${ctx!.publicId}/members/${user!.uid}`, { method: 'DELETE', org: ctx!.publicId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries({ queryKey: ['org'] })
      router.replace('/dashboard/personal')
    },
  })

  if (!ctx) return null
  const self: OrgMemberSelfRow | undefined = (ctx.detail.members as OrgMemberSelfRow[] | undefined)?.[0]

  return (
    <ModulePage title="Organisation" placeholder="" queryKey={['org']} query={detail}>
      <div className="grid max-w-2xl gap-6">
        {leave.isError ? <ErrorNote error={errorText(leave.error.message)} /> : null}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ctx.detail.org.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{ctx.detail.org.kind === 'super_org' ? 'Super-organisation' : 'Organisation'}</Badge>
              {ctx.detail.org.parentName ? <Badge>Part of {ctx.detail.org.parentName}</Badge> : null}
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Organisation ID</dt>
                <dd className="font-mono text-xs">{ctx.detail.org.publicId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Your role</dt>
                <dd>{ctx.role}</dd>
              </div>
              {self?.status ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Your status</dt>
                  <dd>{self.status}</dd>
                </div>
              ) : null}
              {self?.createdAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd>{fmtDate(self.createdAt)}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Leave this organisation</CardTitle>
            <p className="text-sm text-muted-foreground">
              You lose access to {ctx.detail.org.name} and its shared credits.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
              Leave organisation
            </Button>
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave {ctx.detail.org.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will immediately lose access to this organisation. This can’t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => leave.mutate()} disabled={leave.isPending}>
                    {leave.isPending ? 'Leaving…' : 'Leave organisation'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </ModulePage>
  )
}
