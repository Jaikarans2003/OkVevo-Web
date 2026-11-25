'use client'

/**
 * "Join with code" card for a personal account: POST /api/orgs/join with no
 * org header. A super-organisation code returns 422 create_org_first, which
 * opens CreateOrgFirstDialog (the raw code is never shown). Used by the
 * Organisations and Account type modules.
 */
import { useId, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { mutationInlineError, useJoinWithCode } from './actions'
import CreateOrgFirstDialog from './CreateOrgFirstDialog'

export default function JoinWithCodeCard({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  /** Optional header icon (Account type grid cards show one). */
  icon?: LucideIcon
}) {
  const inputId = useId()
  const [code, setCode] = useState('')
  const [createFirstOpen, setCreateFirstOpen] = useState(false)

  const join = useJoinWithCode({
    onCreateOrgFirst: () => setCreateFirstOpen(true),
    onJoined: () => setCode(''),
  })
  const inlineError = mutationInlineError(join.error)

  return (
    <Card className="grid content-start">
      <CardHeader>
        {Icon ? <Icon className="text-[var(--orange)]" size={22} aria-hidden /> : null}
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {inlineError ? (
          <p className="pt-note pt-note--bad" role="alert">
            {inlineError}
          </p>
        ) : null}
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const c = code.trim()
            if (c) join.mutate(c)
          }}
        >
          <div className="grid flex-1 gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={inputId}>
              Join code
            </label>
            <Input
              id={inputId}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. OKV-…"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={join.isPending || !code.trim()}>
            {join.isPending ? 'Joining…' : 'Join'}
          </Button>
        </form>
      </CardContent>
      <CreateOrgFirstDialog open={createFirstOpen} onOpenChange={setCreateFirstOpen} />
    </Card>
  )
}
