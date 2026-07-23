import { useEffect, useState } from 'react'
import { auth } from '@/config/firebase'

export interface PipelineState {
  pipelinePhase: number        // 0 = not started, 2-6 = active, 7 = complete
  pipelineStatus: string       // 'running' | 'awaiting_checkpoint' | 'complete' | undefined
  pipelineMode: 'ask' | 'auto'
  skillId?: string | null
  pendingCheckpointId?: string | null
  videoUrl?: string
  draftVideoUrl?: string
  renderStatus?: string
  renderError?: string
  pipelineUpdatedAt?: Date
}

const POLL_MS = 2000

function shouldKeepPolling(state: PipelineState): boolean {
  // HeyGen draft: persistRenderJob writes these while phase may already be 6.
  if (state.renderStatus === 'RUNNING') return true
  if (state.pipelineStatus === 'rendering') return true
  if (state.pipelineStatus === 'running') return true
  if (state.pipelineStatus === 'awaiting_checkpoint') return true
  const phase = state.pipelinePhase
  return phase >= 2 && phase <= 6 && state.pipelineStatus !== 'complete'
}

/** Chat turn in flight — keep polling so a cold first idle fetch doesn't miss the later render. */
function chatIsActive(chatStatus?: string): boolean {
  return chatStatus === 'submitted' || chatStatus === 'streaming'
}

export function usePipelineState(
  sessionId: string | null,
  chatStatus?: string
): PipelineState | null {
  const [state, setState] = useState<PipelineState | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setState(null)
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const fetchState = async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token || cancelled) return

        const response = await fetch(`/api/agent/sessions/${sessionId}/pipeline`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        })

        if (cancelled) return

        // 404 during ensure race: leave state alone and keep retrying.
        if (response.status === 404) {
          if (!intervalId) {
            intervalId = setInterval(() => void fetchState(), POLL_MS)
          }
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
          skillId?: string | null
          pendingCheckpointId?: string | null
          videoUrl?: string
          draftVideoUrl?: string
          renderStatus?: string
          renderError?: string
          pipelineUpdatedAt?: string
        }

        const next: PipelineState = {
          pipelinePhase: data.pipelinePhase ?? 0,
          pipelineStatus: data.pipelineStatus ?? '',
          pipelineMode: data.pipelineMode ?? 'ask',
          skillId: data.skillId ?? null,
          pendingCheckpointId: data.pendingCheckpointId ?? null,
          videoUrl: data.videoUrl,
          draftVideoUrl: data.draftVideoUrl,
          renderStatus: data.renderStatus,
          renderError: data.renderError,
          pipelineUpdatedAt: data.pipelineUpdatedAt
            ? new Date(data.pipelineUpdatedAt)
            : undefined,
        }

        setState(next)

        // First check after bind: start interval immediately if render already in flight
        // (reopen mid-render) or chat still active (cold idle → later rendering).
        if (shouldKeepPolling(next) || chatIsActive(chatStatus)) {
          if (!intervalId) {
            intervalId = setInterval(() => void fetchState(), POLL_MS)
          }
        } else {
          stopPolling()
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Pipeline state listener error:', error)
        }
      }
    }

    void fetchState()

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [sessionId, chatStatus])

  return state
}
