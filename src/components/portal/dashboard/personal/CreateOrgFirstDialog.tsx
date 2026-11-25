'use client'

/**
 * Shown when an individual pastes a super-organisation join code: the API
 * answers 422 create_org_first. Create goes to Account type; the raw API
 * code string is never rendered.
 */
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function CreateOrgFirstDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create your organisation first</DialogTitle>
          <DialogDescription>
            That code belongs to a super-organisation, and only organisations can join one.
            Create your organisation first, then join with the code from its settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => router.push('/dashboard/personal/account-type')}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
