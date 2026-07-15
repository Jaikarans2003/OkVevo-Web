import { useEffect, useState } from 'react'
import { auth } from '@/config/firebase'

export interface PipelineState {
  pipelinePhase: number        // 0 = not started, 2-6 = active, 7 = complete
  pipelineStatus: string       // 'running' | 'awaiting_approval' | 'complete' | undefined
  pipelineMode: 'ask' | 'auto'
  videoUrl?: string
  draftVideoUrl?: string
  renderStatus?: string
  renderError?: string
  pipelineUpdatedAt?: Date
}

const POLL_MS = 2000

export function usePipelineState(sessionId: string | null): PipelineState | null {
  const [state, setState] = useState<PipelineState | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setState(null)
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const fetchState = async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token || cancelled) return

        const response = await fetch(`/api/agent/sessions/${sessionId}/pipeline`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (cancelled) return

        if (response.status === 404) {
          setState(null)
          return
        }

        if (!response.ok) {
          console.error('Pipeline state fetch error:', response.status)
          return
        }

        const data = (await response.json()) as {
          pipelinePhase: number
          pipelineStatus: string
          pipelineMode: 'ask' | 'auto'
          videoUrl?: string
          draftVideoUrl?: string
          renderStatus?: string
          renderError?: string
          pipelineUpdatedAt?: string
        }

        setState({
          pipelinePhase: data.pipelinePhase ?? 0,
          pipelineStatus: data.pipelineStatus ?? '',
          pipelineMode: data.pipelineMode ?? 'auto',
          videoUrl: data.videoUrl,
          draftVideoUrl: data.draftVideoUrl,
          renderStatus: data.renderStatus,
          renderError: data.renderError,
          pipelineUpdatedAt: data.pipelineUpdatedAt
            ? new Date(data.pipelineUpdatedAt)
            : undefined,
        })
      } catch (error) {
        if (!cancelled) {
          console.error('Pipeline state listener error:', error)
        }
      }
    }

    void fetchState()
    intervalId = setInterval(() => void fetchState(), POLL_MS)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [sessionId])

  return state
}
