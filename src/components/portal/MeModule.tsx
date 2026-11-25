'use client'

import ModulePage from '@/components/portal/ModulePage'
import { queryKeys, useMe } from '@/hooks/useAuthedQuery'

/** Placeholder module page wired to the /api/me query. */
export default function MeModule({
  title,
  placeholder,
}: {
  title: string
  placeholder: string
}) {
  const query = useMe()
  return (
    <ModulePage title={title} placeholder={placeholder} queryKey={queryKeys.me} query={query} />
  )
}
