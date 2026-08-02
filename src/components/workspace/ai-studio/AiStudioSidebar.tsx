'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  FolderOpen,
  Home,
  Palette,
  Plus,
  Search,
} from 'lucide-react';
import {
  AI_STUDIO_SIDEBAR_COLLAPSED_W,
  AI_STUDIO_SIDEBAR_EXPANDED_W,
  SIDEBAR_AVATAR_SRC,
} from '@/components/workspace/ai-studio/constants';
import { useAiStudioWorkspace } from '@/components/workspace/ai-studio/AiStudioWorkspaceProvider';

interface AiStudioSidebarProps {
  collapsed: boolean;
  activeSessionId?: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewProject: () => void;
}

function timeAgo(date: string) {
  const past = new Date(date);
  const diffMs = Date.now() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
}

export default function AiStudioSidebar({
  collapsed,
  activeSessionId,
  onSessionSelect,
  onNewProject,
}: AiStudioSidebarProps) {
  const pathname = usePathname();
  const {
    sessions,
    sessionsLoading,
    sessionsLoadingMore,
    sessionsHasMore,
    sessionsError,
    loadMoreSessions,
  } = useAiStudioWorkspace();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const isFilesPage = pathname.endsWith('/files');

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  // ponytail: search filters only loaded pages — server-side ?q= is the follow-up
  useEffect(() => {
    const root = listScrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !sessionsHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMoreSessions();
        }
      },
      { root, rootMargin: '80px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sessionsHasMore, loadMoreSessions, sessions.length]);

  const filtered = sessions.filter((s) =>
    (s.title || 'Untitled Chat').toLowerCase().includes(search.toLowerCase())
  );

  const sidebarWidth = collapsed ? AI_STUDIO_SIDEBAR_COLLAPSED_W : AI_STUDIO_SIDEBAR_EXPANDED_W;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
      className="absolute inset-y-0 left-0 flex h-full flex-col overflow-hidden border-r border-white/[0.06] bg-[#111111]"
    >
      {collapsed ? (
        <motion.div
          key="collapsed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-1 flex-col items-center gap-3 px-2 py-4"
        >
          <button
            type="button"
            onClick={onNewProject}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/[0.05] hover:text-white"
            aria-label="New project"
          >
            <Plus size={16} />
          </button>
          <Link
            href="/workspace/ai-studio/files"
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/[0.05] hover:text-white ${
              isFilesPage ? 'bg-orange-500/10 text-orange-300' : 'text-white/55'
            }`}
            aria-label="Files"
          >
            <FolderOpen size={16} />
          </Link>
        </motion.div>
      ) : (
        <motion.div
          key="expanded"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, delay: 0.06 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="space-y-3 p-3">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.06] bg-[#1a1a1a] px-3 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/10">
                  <Image
                    src={SIDEBAR_AVATAR_SRC}
                    alt="OkVevo"
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="flex-1 text-left">OkVevo</span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-white/30 transition ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {menuOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                    className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1a1a1a] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                  >
                    <Link
                      href="/workspace"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      <Home size={15} className="text-white/45" />
                      Home
                    </Link>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/[0.06] bg-[#1a1a1a] py-2.5 pl-9 pr-3 text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/20"
              />
            </div>

            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={onNewProject}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-white/70 transition hover:bg-white/[0.05] hover:text-white"
              >
                <Plus size={16} className="text-white/45" />
                New project
              </button>
              <Link
                href="/workspace/ai-studio/files"
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${
                  isFilesPage
                    ? 'border border-white/[0.12] bg-white/[0.04] text-white'
                    : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <FolderOpen size={16} className="text-white/45" />
                Files
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-white/70 transition hover:bg-white/[0.05] hover:text-white"
              >
                <Palette size={16} className="text-white/45" />
                Brand Kit
              </button>
            </nav>
          </div>

          <div
            ref={listScrollRef}
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4"
          >
            <p className="px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Projects
            </p>
            <div className="space-y-0.5">
              {sessionsLoading && sessions.length === 0 ? (
                <p className="px-2.5 py-2 text-sm text-white/30">Loading...</p>
              ) : sessionsError ? (
                <p className="px-2.5 py-2 text-sm text-red-400/80">{sessionsError}</p>
              ) : filtered.length === 0 ? (
                <p className="px-2.5 py-2 text-sm text-white/30">No projects yet</p>
              ) : (
                filtered.map((session) => {
                  const isActive = activeSessionId === session.sessionId;
                  return (
                    <button
                      key={session.sessionId}
                      type="button"
                      onClick={() => onSessionSelect(session.sessionId)}
                      className={`w-full rounded-xl px-2.5 py-2 text-left text-sm transition ${
                        isActive
                          ? 'bg-orange-500/10 text-white'
                          : 'text-white/60 hover:bg-white/[0.04] hover:text-white/85'
                      }`}
                    >
                      <div className="truncate font-medium">
                        {session.title || 'Untitled Chat'}
                      </div>
                      <div className="mt-0.5 text-xs text-white/30">
                        {session.lastMessageAt ? timeAgo(session.lastMessageAt) : 'Just now'}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {sessionsHasMore ? (
              <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
            ) : null}
            {sessionsLoadingMore ? (
              <p className="px-2.5 py-2 text-sm text-white/30">Loading...</p>
            ) : null}
          </div>
        </motion.div>
      )}
    </motion.aside>
  );
}
