'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function AiStudioSidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.12] bg-[#1a1a1a] text-white/70 shadow-[0_4px_20px_rgba(0,0,0,0.55)] transition hover:border-orange-500/30 hover:bg-[#222226] hover:text-white"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
    </button>
  );
}
