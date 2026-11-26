'use client'

/**
 * Join-code card (owner only): shows the active join code, Copy and
 * Regenerate (revokes the previous code). Used by Members and Settings.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { useAuthedQuery } from '@/hooks/useAuthedQuery'
import { accountKey, useAccount } from '@/lib/orgs/accountContext'

import type { JoinCode } from './dashboard-types'
import { ErrorNote } from './dashboard-parts'

export default function JoinCodeCard({
  publicId,
  title = 'Join code',
  description = 'Anyone with this code can join as a member.',
  scopeKey,
}: {
  publicId: string
  title?: string
  description?: string
  /** Page-level query-key scope so ModulePage Refresh also reloads this card. */
  scopeKey: string
}) {
  const { user } = usePortalAuth()
  const account = useAccount()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const key = [scopeKey, 'join-code', accountKey(account)]
  const joinCode = useAuthedQuery<JoinCode>({
    queryKey: [scopeKey, 'join-code'],
    path: `/api/orgs/${publicId}/join-codes`,
  })

  const regenerate = useMutation({
    mutationFn: () =>
      authedJson<JoinCode>(user!, `/api/orgs/${publicId}/join-codes`, {
        method: 'POST',
        body: '{}',
        org: publicId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {joinCode.isError ? <ErrorNote error={joinCode.error} /> : null}
        {regenerate.isError ? <ErrorNote error={regenerate.error} /> : null}
        {joinCode.data ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border bg-secondary px-3 py-2 font-mono text-sm tracking-wider">
              {joinCode.data.code}
            </code>
            <Button
              variant="outline"
              size="sm"
              aria-label="Copy join code"
              onClick={() => {
                void navigator.clipboard?.writeText(joinCode.data.code).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                })
              }}
            >
              {copied ? <Check className="mr-1 h-4 w-4" aria-hidden /> : <Copy className="mr-1 h-4 w-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending}
            >
              <RefreshCw className="mr-1 h-4 w-4" aria-hidden />
              {regenerate.isPending ? 'Replacing…' : 'Replace code'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
