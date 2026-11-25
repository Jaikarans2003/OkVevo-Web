'use client'

/**
 * Personal Billing module (catch-all slug): tabs Transactions | Usage |
 * Credits | Payments, deep-linked at /dashboard/personal/billing/{tab}. The
 * /dashboard/billing/* redirect lands here with slug + query preserved;
 * legacy plan-action slugs (plans, change-plan, cancel, upgrade) fall back
 * to the default tab.
 */
import { useParams, useRouter } from 'next/navigation'

import ModulePage from '@/components/portal/ModulePage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { accountKey, useAccount } from '@/lib/orgs/accountContext'

import CreditsPanel from './CreditsPanel'
import PaymentsTable from './PaymentsTable'
import TransactionsTable from './TransactionsTable'
import UsageExplore, { useUsageExplore } from './UsageExplore'
import { useCreditsQuery, usePaymentsQuery, useTransactionsQuery } from './queries'

const TABS = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'usage', label: 'Usage' },
  { value: 'credits', label: 'Credits' },
  { value: 'payments', label: 'Payments' },
] as const

type BillingTab = (typeof TABS)[number]['value']
const DEFAULT_TAB: BillingTab = 'transactions'

function tabFromSlug(slug: string[] | undefined): BillingTab {
  const raw = slug?.[0]?.toLowerCase()
  return (TABS as readonly { value: string }[]).some((t) => t.value === raw)
    ? (raw as BillingTab)
    : DEFAULT_TAB
}

export default function PersonalBilling() {
  const account = useAccount()
  const router = useRouter()
  const params = useParams<{ slug?: string[] }>()
  const tab = tabFromSlug(params.slug)

  const base = ['billing', accountKey(account)] as const
  const transactions = useTransactionsQuery([...base, 'transactions'], {
    enabled: tab === 'transactions',
  })
  const explore = useUsageExplore([...base, 'usage'], { enabled: tab === 'usage' })
  const credits = useCreditsQuery([...base, 'credits'], { enabled: tab === 'credits' })
  const payments = usePaymentsQuery([...base, 'payments'], { enabled: tab === 'payments' })

  const active =
    tab === 'transactions'
      ? transactions
      : tab === 'usage'
        ? explore.query
        : tab === 'credits'
          ? credits
          : payments

  return (
    <ModulePage
      title="Billing"
      placeholder="Billing module lands in the next wave."
      queryKey={base}
      query={active}
    >
      <Tabs
        value={tab}
        onValueChange={(v) => router.push(`/dashboard/personal/billing/${v}`)}
      >
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="transactions" className="pt-6">
          <TransactionsTable query={transactions} />
        </TabsContent>
        <TabsContent value="usage" className="pt-6">
          <UsageExplore state={explore} />
        </TabsContent>
        <TabsContent value="credits" className="pt-6">
          <CreditsPanel query={credits} />
        </TabsContent>
        <TabsContent value="payments" className="pt-6">
          <PaymentsTable query={payments} />
        </TabsContent>
      </Tabs>
    </ModulePage>
  )
}
