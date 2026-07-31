'use client';

import { useState } from 'react';
import { auth } from '@/config/firebase';
import type { PipelineState } from '@/hooks/usePipelineState';
import { isAgentDevTrace } from '@/lib/agent/agentTraceMode';

const PHASE_LABELS: Record<number, string> = {
  2: 'Transcribing video...',
  3: 'Extracting animation concepts...',
  4: 'Rendering Manim animations...',
  5: 'Building video composition...',
  6: 'Final render running in background...',
};

interface PipelineStatusBarProps {
  pipelineState: PipelineState | null;
  sessionId: string | null;
}

export function PipelineStatusBar({
  pipelineState,
  sessionId,
}: PipelineStatusBarProps) {
  const [checking, setChecking] = useState(false);

  if (!isAgentDevTrace()) {
    return null;
  }

  if (pipelineState === null || pipelineState.pipelinePhase === 0) {
    return null;
  }

  const { pipelinePhase, pipelineStatus, draftVideoUrl, renderStatus } =
    pipelineState;

  // Clip is already shown in chat / deliverables — no redundant "ready" bar.
  if (
    draftVideoUrl ||
    pipelinePhase === 7 ||
    pipelineStatus === 'complete'
  ) {
    return null;
  }

  const phaseLabel = PHASE_LABELS[pipelinePhase];
  const showCheckNow =
    pipelinePhase === 6 && renderStatus === 'RUNNING' && sessionId;

  const checkNow = async () => {
    if (!sessionId || checking) return;
    setChecking(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch(`/api/agent/sessions/${sessionId}/pipeline`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'check_now' }),
      });
      if (!response.ok) console.error('Render check failed:', response.status);
    } finally {
      setChecking(false);
    }
  };

  if (!phaseLabel && !showCheckNow) {
    return null;
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#141414]/95 px-4 py-2.5 text-sm shadow-[0_4px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {phaseLabel ? (
          <>
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-orange-500" />
            <span className="truncate font-medium text-white/75">{phaseLabel}</span>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showCheckNow ? (
          <button
            type="button"
            onClick={checkNow}
            disabled={checking}
            className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-white/70 transition hover:bg-white/5 disabled:opacity-50"
          >
            {checking ? 'Checking...' : 'Check now'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
