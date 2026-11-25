'use client'

/**
 * Super-org › Create organisation (POST /api/orgs with type-to-confirm).
 * The caller becomes the new child org's owner.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'

import { errorText } from '../org/dashboard-utils'
import { ErrorNote } from '../org/dashboard-parts'

export default function CreateOrgDialog({
  publicId,
  open,
  onOpenChange,
}: {
  publicId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [confirmName, setConfirmName] = useState('')

  const create = useMutation({
    mutationFn: () =>
      authedJson(user!, '/api/orgs', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), parent: publicId, confirmName: confirmName.trim() }),
        org: publicId,
      }),
    onSuccess: () => {
      setName('')
      setConfirmName('')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['organisations'] })
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Create organisation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organisation</DialogTitle>
          <DialogDescription>
            A prepaid organisation under this super-organisation. You fund it by sending credits.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim() && confirmName.trim() === name.trim()) create.mutate()
          }}
        >
          {create.isError ? <ErrorNote error={errorText(create.error.message)} /> : null}
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="create-org-name">
              Name
            </label>
            <Input id="create-org-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="create-org-confirm">
              Type the name again to confirm
            </label>
            <Input id="create-org-confirm" value={confirmName} maxLength={120} onChange={(e) => setConfirmName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !name.trim() || confirmName.trim() !== name.trim()}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
