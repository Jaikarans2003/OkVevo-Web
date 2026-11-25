'use client'

/**
 * Org owner › Settings: General (rename + org ID) · Super-organisation
 * (join with code, or Part of X + leave; apply card for upgraded owners
 * without a personal account) · Activity (audit feed) · Danger zone
 * (leave this organisation, alert-dialog).
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ModulePage from '@/components/portal/ModulePage'
import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { useMe, useOrgDetail } from '@/hooks/useAuthedQuery'

import ActivityFeed from './ActivityFeed'
import { useOrgContext } from './dashboard-hooks'
import { errorText } from './dashboard-utils'
import { ErrorNote } from './dashboard-parts'

export default function OrgSettingsModule() {
  const ctx = useOrgContext()
  const detail = useOrgDetail(ctx?.publicId ?? null)
  const [tab, setTab] = useState('general')

  if (!ctx) return null
  return (
    <ModulePage title="Settings" placeholder="" queryKey={[tab === 'activity' ? 'activity' : 'org']} query={detail}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="super">Super-organisation</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="pt-6">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="super" className="pt-6">
          <SuperOrgTab />
        </TabsContent>
        <TabsContent value="activity" className="pt-6">
          <ActivityFeed publicId={ctx.publicId} />
        </TabsContent>
        <TabsContent value="danger" className="pt-6">
          <DangerTab />
        </TabsContent>
      </Tabs>
    </ModulePage>
  )
}

function GeneralTab() {
  const ctx = useOrgContext()
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const rename = useMutation({
    mutationFn: (next: string) =>
      authedJson(user!, `/api/orgs/${ctx!.publicId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: next }),
        org: ctx!.publicId,
      }),
    onSuccess: () => {
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['org'] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
  })

  if (!ctx) return null
  return (
    <div className="grid max-w-2xl gap-6">
      {rename.isError ? <ErrorNote error={errorText(rename.error.message)} /> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{ctx.detail.org.name}</p>
              <p className="text-sm text-muted-foreground">ID: {ctx.detail.org.publicId}</p>
            </div>
            {ctx.canManage ? (
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setName(ctx.detail.org.name) }}>
                <DialogTrigger asChild>
                  <Button variant="outline">Rename</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rename organisation</DialogTitle>
                    <DialogDescription>This changes the name everywhere it appears.</DialogDescription>
                  </DialogHeader>
                  <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const next = name.trim()
                      if (next) rename.mutate(next)
                    }}
                  >
                    <div className="grid gap-1">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="org-rename">
                        Name
                      </label>
                      <Input id="org-rename" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={rename.isPending || !name.trim()}>
                        {rename.isPending ? 'Saving…' : 'Save'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SuperOrgTab() {
  const ctx = useOrgContext()
  const { user } = usePortalAuth()
  const me = useMe()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [applyMessage, setApplyMessage] = useState('')
  const [applyDone, setApplyDone] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const parentName = ctx?.detail.org.parentName ?? null
  const parentId = ctx?.detail.org.parentId ?? null

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['org'] })
    void queryClient.invalidateQueries({ queryKey: ['me'] })
    void queryClient.invalidateQueries({ queryKey: ['overview'] })
    void queryClient.invalidateQueries({ queryKey: ['activity'] })
  }

  const join = useMutation({
    mutationFn: (joinCode: string) =>
      authedJson(user!, '/api/orgs/join', {
        method: 'POST',
        body: JSON.stringify({ code: joinCode }),
        org: ctx!.publicId,
      }),
    onSuccess: () => {
      setCode('')
      invalidate()
    },
  })

  const leaveSuper = useMutation({
    mutationFn: () =>
      authedJson(user!, `/api/orgs/${ctx!.publicId}/leave`, { method: 'POST', body: '{}', org: ctx!.publicId }),
    onSuccess: () => {
      setLeaveOpen(false)
      invalidate()
    },
  })

  const apply = useMutation({
    mutationFn: () =>
      authedJson(user!, '/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          category: 'super_org_application',
          email: user?.email ?? '',
          message: applyMessage.trim(),
          subjectOrgPublicId: ctx!.publicId,
          requestedName: ctx!.detail.org.name,
        }),
        org: null,
      }),
    onSuccess: () => {
      setApplyDone(true)
      setApplyMessage('')
    },
  })

  if (!ctx) return null
  return (
    <div className="grid max-w-2xl gap-6">
      {parentId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Super-organisation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge>Part of {parentName ?? 'a super-organisation'}</Badge>
            </div>
            {ctx.canManage ? (
              <>
                <Button variant="outline" className="text-destructive" onClick={() => setLeaveOpen(true)}>
                  Leave super-organisation
                </Button>
                <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave {parentName ?? 'the super-organisation'}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sponsored credits go back to {parentName ?? 'the super-organisation'}. If this organisation
                        used more than it received, the difference is settled on leave.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => leaveSuper.mutate()} disabled={leaveSuper.isPending}>
                        {leaveSuper.isPending ? 'Leaving…' : 'Leave'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          {ctx.canManage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Join a super-organisation</CardTitle>
                <p className="text-sm text-muted-foreground">Paste a super-organisation join code.</p>
              </CardHeader>
              <CardContent className="grid gap-3">
                {join.isError ? <ErrorNote error={errorText(join.error.message)} /> : null}
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const c = code.trim()
                    if (c) join.mutate(c)
                  }}
                >
                  <div className="grid flex-1 gap-1">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="join-code">
                      Join code
                    </label>
                    <Input id="join-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. OKV-…" />
                  </div>
                  <Button type="submit" disabled={join.isPending || !code.trim()}>
                    {join.isPending ? 'Joining…' : 'Join'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {/* Upgraded owners with no personal account keep the apply card here. */}
          {ctx.canManage && me.data?.hidePersonal ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Apply for super-organisation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Turn {ctx.detail.org.name} into a super-organisation that can fund child organisations.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3">
                {apply.isError ? <ErrorNote error={errorText(apply.error.message)} /> : null}
                {applyDone ? (
                  <p role="status" className="text-sm">Application sent. We’ll be in touch.</p>
                ) : (
                  <form
                    className="grid gap-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (applyMessage.trim()) apply.mutate()
                    }}
                  >
                    <div className="grid gap-1">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="apply-name">
                        Organisation
                      </label>
                      <Input id="apply-name" value={ctx.detail.org.name} readOnly aria-readonly />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="apply-message">
                        Why do you need a super-organisation?
                      </label>
                      <textarea
                        id="apply-message"
                        className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                        value={applyMessage}
                        onChange={(e) => setApplyMessage(e.target.value)}
                      />
                    </div>
                    <div>
                      <Button type="submit" disabled={apply.isPending || !applyMessage.trim()}>
                        {apply.isPending ? 'Sending…' : 'Submit application'}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
      {leaveSuper.isError ? <ErrorNote error={errorText(leaveSuper.error.message)} /> : null}
    </div>
  )
}

function DangerTab() {
  const ctx = useOrgContext()
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
  return (
    <div className="grid max-w-2xl gap-6">
      {leave.isError ? <ErrorNote error={errorText(leave.error.message)} /> : null}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Leave this organisation</CardTitle>
          <p className="text-sm text-muted-foreground">
            You lose access to {ctx.detail.org.name} and its credits. The last owner can’t leave.
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
  )
}
