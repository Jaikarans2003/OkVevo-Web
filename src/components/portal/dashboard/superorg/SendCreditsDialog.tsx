'use client'

/**
 * Super-org › Send credits (POST /api/orgs/:id/transfers).
 * With `preselected` the picker is skipped (row menu / settle flows).
 * Idempotency key is a fresh UUID per dialog open, so a double-click or
 * retry of the same send cannot double-charge the pool.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { useAuthedQuery } from '@/hooks/useAuthedQuery'

import type { ChildOrgRow, Paged } from '../org/dashboard-types'
import { errorText, fmtInt } from '../org/dashboard-utils'
import { ErrorNote } from '../org/dashboard-parts'

export default function SendCreditsDialog({
  publicId,
  preselected,
  preselectedName,
  presetAmount,
  open,
  onOpenChange,
}: {
  publicId: string
  /** Child publicId when the dialog targets one org (row menu / settle). */
  preselected?: string
  preselectedName?: string
  /** Pre-filled amount (settle = the owed amount). */
  presetAmount?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [toOrg, setToOrg] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [idemKey, setIdemKey] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  /* Fresh idempotency key + reset each time the dialog opens. */
  useEffect(() => {
    if (open) {
      setIdemKey(crypto.randomUUID())
      setToOrg(preselected ?? null)
      setAmount(presetAmount != null && presetAmount > 0 ? String(presetAmount) : '')
      setSearch('')
      setQ('')
    }
  }, [open, preselected, presetAmount])

  const picker = useAuthedQuery<Paged<ChildOrgRow>>({
    queryKey: ['organisations', 'picker', q],
    path: `/api/orgs/${publicId}/organisations?${new URLSearchParams({ sort: 'name', limit: '10', ...(q ? { q } : {}) })}`,
    enabled: open && !preselected,
  })

  const send = useMutation({
    mutationFn: (vars: { toOrg: string; credits: number }) =>
      authedJson<{ transferred: number; debtRecovered: number }>(user!, `/api/orgs/${publicId}/transfers`, {
        method: 'POST',
        body: JSON.stringify({ toOrg: vars.toOrg, credits: vars.credits, idempotencyKey: idemKey }),
        org: publicId,
      }),
    onSuccess: () => {
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['transfers'] })
      void queryClient.invalidateQueries({ queryKey: ['organisations'] })
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
      void queryClient.invalidateQueries({ queryKey: ['activity'] })
      void queryClient.invalidateQueries({ queryKey: ['org'] })
    },
  })

  const credits = Number(amount)
  const valid = !!toOrg && Number.isInteger(credits) && credits > 0
  const targetName = preselectedName ?? picker.data?.items.find((o) => o.publicId === toOrg)?.name ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send credits</DialogTitle>
          <DialogDescription>
            Credits move from your pool to the organisation’s sponsored balance. Part of the send first repays any
            owed credits.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && toOrg) send.mutate({ toOrg, credits })
          }}
        >
          {send.isError ? <ErrorNote error={errorText(send.error.message)} /> : null}

          {preselected ? (
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Organisation</span>
              <p className="text-sm font-medium">{preselectedName ?? preselected}</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="send-search">
                Organisation
              </label>
              <Input id="send-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" />
              {picker.isError ? <ErrorNote error={picker.error} /> : null}
              <div className="grid max-h-44 gap-1 overflow-y-auto" role="listbox" aria-label="Organisations">
                {(picker.data?.items ?? []).map((o) => (
                  <button
                    key={o.publicId}
                    type="button"
                    role="option"
                    aria-selected={toOrg === o.publicId}
                    className={`rounded-md border px-3 py-2 text-left text-sm hover:bg-accent ${
                      toOrg === o.publicId ? 'border-primary bg-accent' : ''
                    }`}
                    onClick={() => setToOrg(o.publicId)}
                  >
                    {o.name}
                  </button>
                ))}
                {picker.data && picker.data.items.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">No organisations match.</p>
                ) : null}
              </div>
            </div>
          )}

          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="send-amount">
              Credits
            </label>
            <Input
              id="send-amount"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {Number.isInteger(credits) && credits > 0 ? (
              <p className="text-xs text-muted-foreground">
                Send {fmtInt(credits)} credits{targetName ? ` to ${targetName}` : ''}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!valid || send.isPending}>
              {send.isPending ? 'Sending…' : 'Send credits'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
