'use client';

import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  AiStudioDeliverablesRail,
  DeliverablesToggle,
} from '@/components/workspace/ai-studio/AiStudioDeliverablesPanel';
import { AiStudioSidebarToggle } from '@/components/workspace/ai-studio/AiStudioSidebarToggle';
import { useAiStudioWorkspace } from '@/components/workspace/ai-studio/AiStudioWorkspaceProvider';
import { AI_STUDIO_SIDEBAR_COLLAPSED_W, AI_STUDIO_SIDEBAR_EXPANDED_W } from '@/components/workspace/ai-studio/constants';

export default function AiStudioShellLayout({
  children,
  sidebar,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const {
    deliverablesOpen,
    setDeliverablesOpen,
    showDeliverablesToggle,
    deliverablesCount,
    draftVideoUrl,
  } = useAiStudioWorkspace();

  const sidebarWidth = sidebarCollapsed
    ? AI_STUDIO_SIDEBAR_COLLAPSED_W
    : AI_STUDIO_SIDEBAR_EXPANDED_W;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#141414] text-white">
      <div
        className="relative shrink-0 overflow-hidden transition-[width] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ width: sidebarWidth }}
      >
        {sidebar}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#141414]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative shrink-0 px-4 pt-3">
            <div className="relative flex h-8 items-center justify-between gap-3">
              <div className="z-40 shrink-0">
                <AiStudioSidebarToggle collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />
              </div>

              <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-28">
                {!bannerDismissed ? (
                  <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#141414]/95 px-4 py-1.5 text-xs text-white/45 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md">
                    <span>AI models consume credits per render</span>
                    <button
                      type="button"
                      onClick={() => setBannerDismissed(true)}
                      className="rounded p-0.5 text-white/30 transition hover:text-white/60"
                      aria-label="Dismiss credits notice"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="z-40 ml-auto shrink-0">
                {showDeliverablesToggle ? (
                  <DeliverablesToggle
                    count={deliverablesCount}
                    active={deliverablesOpen}
                    onClick={() => setDeliverablesOpen((o) => !o)}
                  />
                ) : (
                  <div className="h-8 w-[7.5rem]" aria-hidden />
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>

        {showDeliverablesToggle ? (
          <AiStudioDeliverablesRail
            open={deliverablesOpen}
            fileCount={deliverablesCount}
            draftVideoUrl={draftVideoUrl}
          />
        ) : null}
      </div>
    </div>
  );
}
