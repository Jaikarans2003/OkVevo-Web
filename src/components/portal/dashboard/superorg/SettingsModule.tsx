'use client'

/**
 * Super-org › Settings: General (rename + org ID) · Join code · Activity
 * (audit feed incl. children). The rename card duplicates the small
 * pattern from org/SettingsModule (kept local per worker ownership).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

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
import { useOrgDetail } from '@/hooks/useAuthedQuery'

import ActivityFeed from '../org/ActivityFeed'
import JoinCodeCard from '../org/JoinCodeCard'
import { useOrgContext } from '../org/dashboard-hooks'
import { errorText } from '../org/dashboard-utils'
import { ErrorNote } from '../org/dashboard-parts'

export default function SuperSettingsModule() {
  const ctx = useOrgContext()
  const detail = useOrgDetail(ctx?.publicId ?? null)
  const [tab, setTab] = useState('general')

  if (!ctx) return null
  return (
    <ModulePage
      title="Settings"
      placeholder=""
      queryKey={[tab === 'activity' ? 'activity' : tab === 'joincode' ? 'settings' : 'org']}
      query={detail}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="joincode">Join code</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="pt-6">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="joincode" className="pt-6">
          <div className="max-w-2xl">
            <JoinCodeCard
              publicId={ctx.publicId}
              title="Organisation join code"
              description="An organisation owner joins this super-organisation with this code."
              scopeKey="settings"
            />
          </div>
        </TabsContent>
        <TabsContent value="activity" className="pt-6">
          <ActivityFeed publicId={ctx.publicId} showOrgName />
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
          <CardTitle className="text-base">Super-organisation</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <DialogTitle>Rename super-organisation</DialogTitle>
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
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="super-rename">
                        Name
                      </label>
                      <Input id="super-rename" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
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
