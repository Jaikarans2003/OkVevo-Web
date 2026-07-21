'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import type { DeliverableVideo } from '@/components/workspace/ai-studio/AiStudioWorkspaceProvider';

const PANEL_EASE = [0.32, 0.72, 0, 1] as const;
const PANEL_DURATION = 0.44;

function VideoCard({ url, label }: { url: string; label: string }) {
  return (
    <article className="mb-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#1f1f1f]/80">
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full bg-black/50"
      />
      <div className="flex items-center gap-2 p-3 text-sm font-medium text-white/88">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-orange-300 transition hover:text-orange-200"
        >
          Open
        </a>
      </div>
    </article>
  );
}

export function AiStudioDeliverablesRail({
  open,
  fileCount = 0,
  draftVideoUrl,
  renderedVideos = [],
}: {
  open: boolean;
  fileCount?: number;
  draftVideoUrl?: string;
  renderedVideos?: DeliverableVideo[];
}) {
  return (
    <AnimatePresence initial={false} mode="sync">
      {open ? (
        <motion.aside
          key="deliverables-rail"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '44%', opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: PANEL_DURATION, ease: PANEL_EASE }}
          className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-[#161616]"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#141414] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent" />

          <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-white/[0.05] px-5 py-3.5">
            <FolderOpen className="h-4 w-4 shrink-0 text-orange-400/90" />
            <h2 className="flex-1 text-sm font-semibold uppercase tracking-wide text-white/85">
              Deliverables
              <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-normal normal-case text-white/50">
                {fileCount} files
              </span>
            </h2>
          </header>

          <div className="custom-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto px-5 pb-8">
            {draftVideoUrl ? (
              <div className="mt-4 pt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/42">
                  Final video
                </div>
                <VideoCard url={draftVideoUrl} label="final.mp4" />
              </div>
            ) : null}
            {renderedVideos.length > 0 ? (
              <div className="mt-4 pt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/42">
                  Rendered clips ({renderedVideos.length})
                </div>
                {renderedVideos.map((video) => (
                  <VideoCard key={video.id} url={video.url} label={video.label} />
                ))}
              </div>
            ) : null}
            {!draftVideoUrl && renderedVideos.length === 0 ? (
              <p className="mt-8 text-center text-sm text-white/38">
                Renders and exports will appear here.
              </p>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

export function DeliverablesToggle({
  count,
  active,
  onClick,
}: {
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      layout
      transition={{ duration: 0.32, ease: PANEL_EASE }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur-md ${
        active
          ? 'border-orange-500/35 bg-orange-500/12 text-white/88 shadow-[0_0_20px_-6px_rgba(249,115,22,0.45)]'
          : 'border-white/[0.08] bg-[#141414]/95 text-white/55 hover:border-white/[0.14] hover:text-white/78'
      }`}
      whileTap={{ scale: 0.97 }}
    >
      <FolderOpen
        size={13}
        className={`transition-colors duration-300 ${active ? 'text-orange-400' : 'text-white/45'}`}
      />
      Deliverables
      <AnimatePresence initial={false}>
        {count > 0 ? (
          <motion.span
            key="count"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.22, ease: PANEL_EASE }}
            className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300"
          >
            {count}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}
