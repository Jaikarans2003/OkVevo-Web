'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SKILLS = [
  {
    id: 'edu-video',
    name: 'Edu-Video',
    description:
      "Turn a teacher's lecture recording into a polished LMS Ready Educational video.",
    icon: '🎬',
    requiresVideo: true,
  },
  {
    id: 'background-generation',
    name: 'Background',
    description:
      'Generate a photo or video backdrop for your scene — studio plates, stylized worlds, or short motion loops.',
    icon: '🖼️',
    requiresVideo: false,
  },
] as const;
interface SkillsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (skillId: string, displayName: string) => void;
}

export function SkillsPopup({
  isOpen,
  onClose,
  onSelectSkill,
}: SkillsPopupProps) {
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-label="Close skills"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Skills"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141414] shadow-[0_8px_48px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/90">
              Skills
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white/90">
              Choose a skill
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
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto custom-scrollbar p-2">
          {SKILLS.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() => {
                onSelectSkill(skill.id, skill.name);
                onClose();
              }}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.05]"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-lg"
                aria-hidden
              >
                {skill.icon}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-sm font-medium text-white/85">
                  {skill.name}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-white/45">
                  {skill.description}
                </span>
                {skill.requiresVideo ? (
                  <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    Requires video upload
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
