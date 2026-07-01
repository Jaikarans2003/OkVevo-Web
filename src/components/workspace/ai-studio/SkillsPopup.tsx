'use client';

import { useEffect, useRef } from 'react';

const SKILLS = [
  {
    id: 'edu-video',
    name: 'Edu-Video',
    description:
      'Transform a teacher recording into a polished educational video with Manim animations',
    icon: '🎬',
    requiresVideo: true,
  },
  {
    id: 'hyperframes',
    name: 'HyperFrames',
    description: 'Build custom HTML video compositions with multiple layers and effects',
    icon: '🎨',
    requiresVideo: false,
  },
  {
    id: 'manim-video',
    name: 'Manim Video',
    description:
      'Generate Manim Python animation scripts for mathematical and technical visualizations',
    icon: '📐',
    requiresVideo: false,
  },
] as const;

const dropdownPanelClass =
  'absolute bottom-full z-50 mb-2 max-h-56 overflow-y-auto custom-scrollbar rounded-xl border border-white/[0.08] bg-[#1a1a1a] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]';

interface SkillsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (skillId: string, displayName: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function SkillsPopup({
  isOpen,
  onClose,
  onSelectSkill,
  anchorRef,
}: SkillsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popupRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      className={`${dropdownPanelClass} right-0 w-56`}
      role="dialog"
      aria-label="Skills"
    >
      {SKILLS.map((skill) => (
        <div
          key={skill.id}
          className="border-b border-white/[0.05] px-3 py-2 last:border-b-0 hover:bg-white/[0.05]"
        >
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-sm" aria-hidden>
              {skill.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white/75">{skill.name}</div>
              <p className="mt-0.5 text-xs text-white/45">{skill.description}</p>
              {skill.requiresVideo ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Requires video upload
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onSelectSkill(skill.id, skill.name);
                  onClose();
                }}
                className="mt-2 rounded-full bg-orange-500 px-3 py-1 text-sm text-white transition hover:bg-orange-400"
              >
                Use skill
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
