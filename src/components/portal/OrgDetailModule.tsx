'use client'

import ModulePage from '@/components/portal/ModulePage'
import { queryKeys, useOrgDetail } from '@/hooks/useAuthedQuery'
import { useAccount } from '@/lib/orgs/accountContext'

/** Placeholder module page wired to the active org's detail query. */
export default function OrgDetailModule({
  title,
  placeholder,
}: {
  title: string
  placeholder: string
}) {
  const account = useAccount()
  const publicId = account?.account === 'org' ? account.publicId : null
  const query = useOrgDetail(publicId)
  return (
    <ModulePage
      title={title}
      placeholder={placeholder}
      queryKey={queryKeys.org(publicId ?? 'none')}
      query={query}
    />
  )
}
