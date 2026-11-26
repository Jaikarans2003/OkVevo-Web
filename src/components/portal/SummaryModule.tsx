'use client'

import ModulePage from '@/components/portal/ModulePage'
import { queryKeys, useSummary } from '@/hooks/useAuthedQuery'
import { useAccount } from '@/lib/orgs/accountContext'

/** Placeholder module page wired to the account's billing summary query. */
export default function SummaryModule({
  title,
  placeholder,
}: {
  title: string
  placeholder: string
}) {
  const account = useAccount()
  const query = useSummary()
  return (
    <ModulePage
      title={title}
      placeholder={placeholder}
      queryKey={queryKeys.summary(account)}
      query={query}
    />
  )
}
