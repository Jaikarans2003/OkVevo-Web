'use client';

import { useEffect, useRef } from 'react';

const SKILLS = [
  {
    id: 'edu-video',
    name: 'Edu-Video',
    description:
      "Turn a teacher's lecture recording into a polished educational video with AI-generated animations, visuals, captions, and explanations.",
    icon: '🎬',
    requiresVideo: true,
  },
  {
    id: 'remove-background',
    name: 'Remove Background',
    description:
      'Remove the background from a person/portrait video and get a transparent cutout ready for compositing.',
    icon: '✂️',
    requiresVideo: true,
  },
  {
    id: 'background-generator',
    name: 'Background Generator',
    description:
      'Generate a backdrop image from a text prompt — ideal for placing behind a transparent subject.',
    icon: '🖼️',
    requiresVideo: false,
  },
  {
    id: 'background-video-generator',
    name: 'Background Video',
    description:
      'Generate a short moving backdrop video from a text prompt (max 15 seconds) for compositing behind a subject.',
    icon: '🎥',
    requiresVideo: false,
  },
  {
    id: 'composite-subject',
    name: 'Composite Subject',
    description:
      'Place a transparent cutout over a background image or video and export a final MP4.',
    icon: '🧩',
    requiresVideo: false,
  },
] as const;

const dropdownPanelClass =
  'absolute bottom-full z-50 mb-2 max-h-[min(28rem,70vh)] overflow-y-auto custom-scrollbar rounded-xl border border-white/[0.08] bg-[#1a1a1a] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]';

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
      className={`${dropdownPanelClass} right-0 w-80`}
      role="dialog"
      aria-label="Skills"
    >
      {SKILLS.map((skill) => (
        <button
          key={skill.id}
          type="button"
          onClick={() => {
            onSelectSkill(skill.id, skill.name);
            onClose();
          }}
          className="flex w-full items-start gap-2 border-b border-white/[0.05] px-3 py-2.5 text-left last:border-b-0 hover:bg-white/[0.05]"
        >
          <span className="shrink-0 text-sm" aria-hidden>
            {skill.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white/80">
              {skill.name}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-white/45">
              {skill.description}
            </span>
            {skill.requiresVideo ? (
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Requires video upload
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
