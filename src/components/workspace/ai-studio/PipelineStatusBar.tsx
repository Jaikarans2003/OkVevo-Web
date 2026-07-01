'use client';

import type { PipelineState } from '@/hooks/usePipelineState';

const PHASE_LABELS: Record<number, string> = {
  2: 'Transcribing video...',
  3: 'Extracting animation concepts...',
  4: 'Rendering Manim animations...',
  5: 'Building video composition...',
  6: 'Rendering final video...',
};

interface PipelineStatusBarProps {
  pipelineState: PipelineState | null;
  onApprove: () => void;
  sessionId: string | null;
}

export function PipelineStatusBar({
  pipelineState,
  onApprove,
}: PipelineStatusBarProps) {
  if (
    pipelineState === null ||
    pipelineState.pipelinePhase === 0 ||
    pipelineState.pipelinePhase === 7 ||
    pipelineState.pipelineStatus === 'complete'
  ) {
    return null;
  }

  const { pipelinePhase, pipelineStatus, draftVideoUrl } = pipelineState;
  const phaseLabel = PHASE_LABELS[pipelinePhase];
  const showApprovalGate =
    pipelinePhase === 3 && pipelineStatus === 'awaiting_approval';

  if (!phaseLabel && !draftVideoUrl) {
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
        {draftVideoUrl ? (
          <a
            href={draftVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-orange-300 transition hover:text-orange-200"
          >
            Watch your video
          </a>
        ) : null}
        {showApprovalGate ? (
          <button
            type="button"
            onClick={onApprove}
            className="flex items-center justify-center rounded-full bg-orange-500 px-4 py-1.5 text-sm text-white transition hover:bg-orange-400"
          >
            Approve & Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}
