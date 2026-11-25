'use client'

/**
 * Shared module page frame (plan §8). W3+ replaces `children` bodies only —
 * header, Refresh, "Updated … ago" and the loading skeleton stay shared.
 * Refresh invalidates the module's query keys in the one client cache.
 */
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useEffect, useReducer, type ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

function updatedLabel(dataUpdatedAt: number, now: number): string {
  if (!dataUpdatedAt) return 'Not loaded yet'
  const secs = Math.max(0, Math.round((now - dataUpdatedAt) / 1000))
  if (secs < 5) return 'Updated just now'
  if (secs < 60) return `Updated ${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `Updated ${mins}m ago`
  return `Updated ${Math.floor(mins / 60)}h ago`
}

export default function ModulePage({
  title,
  placeholder,
  queryKey,
  query,
  children,
}: {
  title: string
  /** Muted one-liner while the module body is a placeholder. */
  placeholder: string
  /** The module's query keys — Refresh invalidates exactly these. */
  queryKey: readonly unknown[]
  /** The module's one query (skeleton while pending, dataUpdatedAt label). */
  query: Pick<UseQueryResult<unknown, Error>, 'isPending' | 'dataUpdatedAt'>
  children?: ReactNode
}) {
  const queryClient = useQueryClient()
  // Tick so "Updated Xs ago" stays honest between renders.
  const [now, tick] = useReducer(() => Date.now(), Date.now())
  useEffect(() => {
    const t = setInterval(tick, 15_000)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="wrap pt-stack">
      <header className="dashboard-module-head">
        <h1>{title}</h1>
        <div className="dashboard-module-meta">
          <span className="pt-fine" aria-live="polite">
            {updatedLabel(query.dataUpdatedAt, now)}
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => queryClient.invalidateQueries({ queryKey })}
            aria-label={`Refresh ${title}`}
          >
            <RefreshCw size={15} aria-hidden />
            Refresh
          </button>
        </div>
      </header>
      {query.isPending ? (
        <div className="grid gap-5" role="status" aria-busy="true" aria-label={`Loading ${title}`}>
          <Skeleton className="h-36 rounded-[var(--r)]" />
          <Skeleton className="h-56 rounded-[var(--r)]" />
        </div>
      ) : (
        (children ?? <p className="pt-fine">{placeholder}</p>)
      )}
    </section>
  )
}
