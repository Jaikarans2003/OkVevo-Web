'use client'

/**
 * Personal Account type module: the current account-type badge (from the
 * billing summary's accountKind), a static "what changes if you upgrade"
 * explainer (create / apply / join, per plan §2), and a link to pricing.
 */
import Link from 'next/link'
import { Building2, Crown, Users } from 'lucide-react'

import ModulePage from '@/components/portal/ModulePage'
import { Badge } from '@/components/ui/badge'
import { accountKey, useAccount } from '@/lib/orgs/accountContext'

import { useSummaryQuery } from './queries'

const KIND_LABELS: Record<string, string> = {
  individual: 'Individual',
  org: 'Organisation',
  super_org: 'Super-organisation',
}

const EXPLAINER = [
  {
    icon: Users,
    title: 'Create an organisation',
    body: 'One shared wallet for your team. You become the owner: invite members with a join code, set owner and member roles, and see everyone’s usage and jobs in one place. Your personal credits and history stay yours.',
  },
  {
    icon: Building2,
    title: 'Apply for a super-organisation',
    body: 'For studios and agencies running several teams. Sponsor child organisations with credit transfers, and watch wallet health, burn and days left across every org from one dashboard.',
  },
  {
    icon: Crown,
    title: 'Join a super-organisation',
    body: 'Already part of a bigger team? Join with their code. Your work is funded by the parent organisation and shows in a separate “From” bucket on your Overview.',
  },
] as const

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

          <div className="grid gap-5 md:grid-cols-3">
            {EXPLAINER.map((card) => (
              <div
                key={card.title}
                className="grid content-start gap-3 rounded-xl border bg-card p-5 text-card-foreground shadow"
              >
                <card.icon className="text-[var(--orange)]" size={22} aria-hidden />
                <h2 className="text-lg font-semibold">{card.title}</h2>
                <p className="text-sm text-muted-foreground">{card.body}</p>
              </div>
            ))}
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
