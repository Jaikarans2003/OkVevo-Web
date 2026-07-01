'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

export function FilesEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col items-center justify-center text-center"
    >
      <div className="relative mb-8">
        <div className="flex flex-col items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 w-[4.5rem] rounded-2xl border border-white/[0.08] bg-[#1c1c1c]"
              style={{
                transform: `translateY(${i * -6}px) scale(${1 - i * 0.04})`,
                opacity: 1 - i * 0.12,
                zIndex: 3 - i,
              }}
            />
          ))}
        </div>
        <div className="absolute -bottom-1 -left-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] bg-[#2a2a2a] shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          <Plus size={16} className="text-white/70" strokeWidth={2} />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-white/90">No files yet</h2>
      <p className="mt-2 text-sm text-white/40">Start a new task to generate files</p>
    </motion.div>
  );
}
