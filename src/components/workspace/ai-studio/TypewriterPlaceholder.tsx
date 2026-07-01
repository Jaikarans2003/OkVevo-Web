'use client';

import { useEffect, useState } from 'react';

const TYPE_MS = 42;
const DELETE_MS = 26;
const PAUSE_AT_FULL_MS = 1400;
const PAUSE_AT_EMPTY_MS = 320;

type Phase = 'typing' | 'pause-full' | 'deleting' | 'pause-empty';

export function TypewriterPlaceholder({
  prompts,
  active,
}: {
  prompts: readonly string[];
  active: boolean;
}) {
  const [promptIndex, setPromptIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');

  const text = prompts[promptIndex] ?? '';

  useEffect(() => {
    if (!active) return;
    setPromptIndex(0);
    setCharCount(0);
    setPhase('typing');
  }, [active]);

  useEffect(() => {
    if (!active) return;

    if (phase === 'typing') {
      if (charCount >= text.length) {
        setPhase('pause-full');
        return;
      }
      const id = window.setTimeout(() => setCharCount((c) => c + 1), TYPE_MS);
      return () => window.clearTimeout(id);
    }

    if (phase === 'pause-full') {
      const id = window.setTimeout(() => setPhase('deleting'), PAUSE_AT_FULL_MS);
      return () => window.clearTimeout(id);
    }

    if (phase === 'deleting') {
      if (charCount <= 0) {
        setPhase('pause-empty');
        return;
      }
      const id = window.setTimeout(() => setCharCount((c) => c - 1), DELETE_MS);
      return () => window.clearTimeout(id);
    }

    if (phase === 'pause-empty') {
      const id = window.setTimeout(() => {
        setPromptIndex((i) => (i + 1) % prompts.length);
        setPhase('typing');
      }, PAUSE_AT_EMPTY_MS);
      return () => window.clearTimeout(id);
    }
  }, [active, charCount, phase, prompts.length, text.length]);

  useEffect(() => {
    if (!active || phase !== 'typing') return;
    if (charCount > text.length) {
      setCharCount(text.length);
    }
  }, [active, charCount, phase, text]);

  if (!active) return null;

  const visible = text.slice(0, charCount);
  const showCursor = phase === 'typing' || phase === 'deleting';

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 text-sm leading-relaxed text-white/40"
      aria-hidden
    >
      {visible}
      {showCursor ? <span className="ml-px text-orange-400/70">▍</span> : null}
    </div>
  );
}
