'use client'

/**
 * Personal Account type module: the current account-type badge (from the
 * billing summary's accountKind), three functional cards — Create
 * organisation (POST /api/me/upgrade, then open the new org), Apply for
 * super-organisation (POST /api/contact with requestedName), Join a
 * super-organisation (shared JoinWithCodeCard; 422 create_org_first opens
 * the dialog) — and a link to pricing.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Building2, Crown, Users } from 'lucide-react'

import ModulePage from '@/components/portal/ModulePage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { accountKey, useAccount } from '@/lib/orgs/accountContext'

import { mutationInlineError, useApplySuperOrg, useCreateOrganisation } from './actions'
import JoinWithCodeCard from './JoinWithCodeCard'
import { useSummaryQuery } from './queries'

const KIND_LABELS: Record<string, string> = {
  individual: 'Individual',
  org: 'Organisation',
  super_org: 'Super-organisation',
}

function CreateOrganisationCard() {
  const router = useRouter()
  const inputId = useId()
  const [name, setName] = useState('')
  const create = useCreateOrganisation({
    onCreated: (orgPublicId) => router.push(`/dashboard/o/${orgPublicId}`),
  })
  const inlineError = mutationInlineError(create.error)

  return (
    <Card className="grid content-start">
      <CardHeader>
        <Users className="text-[var(--orange)]" size={22} aria-hidden />
        <CardTitle className="text-lg">Create an organisation</CardTitle>
        <p className="text-sm text-muted-foreground">
          One shared wallet for your team. You become the owner: invite members with a join code,
          set roles, and see everyone’s usage in one place. Your personal credits stay yours.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {inlineError ? (
          <p className="pt-note pt-note--bad" role="alert">
            {inlineError}
          </p>
        ) : null}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const n = name.trim()
            if (n) create.mutate(n)
          }}
        >
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={inputId}>
              Organisation name
            </label>
            <Input
              id={inputId}
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Studio"
            />
          </div>
          <div>
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? 'Creating…' : 'Create organisation'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ApplySuperOrgCard() {
  const nameId = useId()
  const reasonId = useId()
  const [requestedName, setRequestedName] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const apply = useApplySuperOrg({
    onApplied: () => {
      setDone(true)
      setRequestedName('')
      setMessage('')
    },
  })
  const inlineError = mutationInlineError(apply.error)

  return (
    <Card className="grid content-start">
      <CardHeader>
        <Building2 className="text-[var(--orange)]" size={22} aria-hidden />
        <CardTitle className="text-lg">Apply for a super-organisation</CardTitle>
        <p className="text-sm text-muted-foreground">
          For studios and agencies running several teams. Sponsor child organisations with credit
          transfers and watch wallet health across every org from one dashboard.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {inlineError ? (
          <p className="pt-note pt-note--bad" role="alert">
            {inlineError}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="text-sm">
            Application sent. We’ll be in touch.
          </p>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const n = requestedName.trim()
              const m = message.trim()
              if (n && m) apply.mutate({ requestedName: n, message: m })
            }}
          >
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={nameId}>
                Super-organisation name
              </label>
              <Input
                id={nameId}
                value={requestedName}
                maxLength={120}
                onChange={(e) => setRequestedName(e.target.value)}
                placeholder="e.g. Acme Group"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={reasonId}>
                Why do you need a super-organisation?
              </label>
              <textarea
                id={reasonId}
                className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div>
              <Button
                type="submit"
                disabled={apply.isPending || !requestedName.trim() || !message.trim()}
              >
                {apply.isPending ? 'Sending…' : 'Submit application'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function PersonalAccountType() {
  const account = useAccount()
  const base = ['account-type', accountKey(account)] as const
  const summary = useSummaryQuery([...base, 'summary'])

  const kind = summary.data?.accountKind ?? 'individual'
  const label = KIND_LABELS[kind] ?? 'Individual'

  return (
    <ModulePage
      title="Account type"
      placeholder="Account type module lands in the next wave."
      queryKey={base}
      query={summary}
    >
      {summary.isError ? (
        <p className="pt-note pt-note--bad" role="alert">
          Couldn’t load your account type. {summary.error.message}
        </p>
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5 text-card-foreground shadow">
            <p className="text-sm text-muted-foreground">Your current account type</p>
            <Badge variant="default" className="text-sm">
              {label}
            </Badge>
          </div>

          <div className="grid items-start gap-5 md:grid-cols-3">
            <CreateOrganisationCard />
            <ApplySuperOrgCard />
            <JoinWithCodeCard
              icon={Crown}
              title="Join a super-organisation"
              description="Already part of a bigger team? Join with their code. Your work is funded by the parent organisation and shows in a separate “From” bucket on your Overview."
            />
          </div>

          <div>
            <Link className="btn btn--go" href="/pricing">
              See plans and pricing
            </Link>
          </div>
        </div>
      )}
    </ModulePage>
  )
}
