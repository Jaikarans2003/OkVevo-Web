'use client';

import { ArrowRight, Film, Sparkles, Subtitles, Wand2 } from 'lucide-react';

const QUICK_CHIPS = [
  { label: 'Karaoke captions', prompt: 'Add karaoke captions to my video', icon: Subtitles },
  { label: 'Build with skills', prompt: 'Use the best skill for my edit', icon: Sparkles, badge: 'New' as const },
  { label: 'Create UGC', prompt: 'Make this feel like authentic UGC', icon: Wand2 },
  { label: 'HyperFrames', prompt: 'Help me plan a HyperFrames video', icon: Film },
  { label: 'Vertical clips', prompt: 'Cut my long video into 5 vertical clips', icon: Film },
];

const EXAMPLE_PROMPTS = [
  'Cut my hour-long interview into 5 vertical clips with captions and hooks.',
  'Turn my stream recording into TikTok-ready clips with bold subtitles.',
  'Find the best moments in my podcast and add karaoke-style captions.',
];

export function AiStudioHeroExtras({ onPickPrompt }: { onPickPrompt: (p: string) => void }) {
  return (
    <div className="mt-5 w-full space-y-5">
      <div className="flex flex-wrap justify-center gap-2">
        {QUICK_CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onPickPrompt(chip.prompt)}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#141414]/90 px-3.5 py-2 text-xs text-white/70 transition hover:border-orange-500/25 hover:bg-[#1a1a1a] hover:text-white/90"
            >
              <Icon size={13} className="text-orange-400/70" />
              {chip.label}
              {'badge' in chip && chip.badge ? (
                <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-orange-300">
                  {chip.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <ul className="mx-auto max-w-xl space-y-2.5">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPickPrompt(prompt)}
              className="group flex w-full items-start gap-2.5 text-left text-sm text-white/40 transition hover:text-white/70"
            >
              <ArrowRight
                size={14}
                className="mt-0.5 shrink-0 text-orange-500/40 transition group-hover:text-orange-400/80"
              />
              <span className="leading-snug">{prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
