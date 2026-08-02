'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SessionLimitModalProps {
  open: boolean;
  estimatedTokens?: number | null;
  onClose: () => void;
  onStartNewChat: () => void;
  /** Wired in Part 2/4 — disabled until export exists. */
  onDownloadProject?: () => void;
  downloadBusy?: boolean;
  downloadEnabled?: boolean;
  /** Wired in Part 3 — disabled until purge exists. */
  onDownloadAndDelete?: () => void;
  deleteBusy?: boolean;
  deleteEnabled?: boolean;
}

export function SessionLimitModal({
  open,
  estimatedTokens,
  onClose,
  onStartNewChat,
  onDownloadProject,
  downloadBusy,
  downloadEnabled = false,
  onDownloadAndDelete,
  deleteBusy,
  deleteEnabled = false,
}: SessionLimitModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-label="Close session limit dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-limit-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141414] shadow-[0_8px_48px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/90">
              Session limit
            </p>
            <h2
              id="session-limit-title"
              className="mt-1 text-lg font-semibold text-white/90"
            >
              This chat is too large to continue
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-white/65">
            Context size exceeded the hard limit
            {estimatedTokens != null
              ? ` (~${Math.round(estimatedTokens / 1000)}k tokens)`
              : ''}
            . Start a new chat to keep working, or download this project first.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onStartNewChat}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400"
            >
              Start New Chat
            </button>
            <button
              type="button"
              disabled={!downloadEnabled || downloadBusy}
              onClick={onDownloadProject}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {downloadBusy ? 'Downloading…' : 'Download Project'}
            </button>
            <button
              type="button"
              disabled={!deleteEnabled || deleteBusy}
              onClick={onDownloadAndDelete}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleteBusy ? 'Deleting…' : 'Download & Delete Permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
