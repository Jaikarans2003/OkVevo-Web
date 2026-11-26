import { Skeleton } from '@/components/ui/skeleton'

/**
 * Content-area skeleton for the dashboard (route loading.tsx, redirects,
 * account gates). Never a full-screen loader — the sidebar stays put.
 */
export default function DashboardContentSkeleton() {
  return (
    <div className="wrap pt-stack" role="status" aria-busy="true" aria-label="Loading">
      <div className="grid gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-36 rounded-[var(--r)]" />
        <Skeleton className="h-36 rounded-[var(--r)]" />
      </div>
      <Skeleton className="h-56 rounded-[var(--r)]" />
    </div>
  )
}
