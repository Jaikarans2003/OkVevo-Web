'use client';

import { useEffect, useMemo, useState } from 'react';

const TYPE_MS = 38;

export function HeroTypewriterHeading({
  firstName,
  ready = true,
}: {
  firstName?: string;
  ready?: boolean;
}) {
  const { fullText, orangeLength, line1Length } = useMemo(() => {
    const prefix = firstName ? `${firstName.toUpperCase()}, ` : '';
    const line1 = `${prefix}WHAT ARE WE`;
    const line2 = 'CREATING TODAY?';
    return {
      fullText: `${line1}\n${line2}`,
      orangeLength: prefix.length,
      line1Length: line1.length,
    };
  }, [firstName]);

  const [charCount, setCharCount] = useState(0);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!ready) {
      setCharCount(0);
      setDone(false);
      setStarted(false);
      return;
    }
    setCharCount(0);
    setDone(false);
    setStarted(true);
  }, [fullText, ready]);

  useEffect(() => {
    if (!ready || !started) return;

    if (charCount >= fullText.length) {
      const t = window.setTimeout(() => setDone(true), 400);
      return () => window.clearTimeout(t);
    }
    const id = window.setTimeout(() => setCharCount((c) => c + 1), TYPE_MS);
    return () => window.clearTimeout(id);
  }, [charCount, fullText.length, ready, started]);

  const headingClass =
    'max-w-3xl font-mono text-2xl font-bold uppercase leading-[1.1] tracking-[-0.04em] [word-spacing:-0.14em] sm:text-3xl md:text-[2.35rem]';

  if (!ready) {
    return (
      <h1 className={`${headingClass} min-h-[2.6em] sm:min-h-[2.4em]`} aria-hidden>
        <span className="invisible">WHAT ARE WE CREATING TODAY?</span>
      </h1>
    );
  }

  const visible = fullText.slice(0, charCount);
  const orangePart = visible.slice(0, Math.min(orangeLength, visible.length));
  const afterOrange = visible.slice(orangeLength);
  const newlineAt = afterOrange.indexOf('\n');
  const line1White = newlineAt >= 0 ? afterOrange.slice(0, newlineAt) : afterOrange;
  const line2Visible = newlineAt >= 0 ? afterOrange.slice(newlineAt + 1) : '';
  const showCursor = !done && charCount > 0;

  return (
    <h1 className={headingClass}>
      <span className="block">
        {orangePart ? (
          <span className="bg-gradient-to-b from-orange-300 via-orange-400 to-orange-600/70 bg-clip-text text-transparent">
            {orangePart}
          </span>
        ) : null}
        {line1White ? (
          <span className="bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent">
            {line1White}
          </span>
        ) : null}
        {showCursor && charCount <= line1Length ? (
          <span className="ml-px inline-block text-orange-400">▍</span>
        ) : null}
      </span>
      {(line2Visible || charCount > line1Length + 1) && (
        <span className="mt-0.5 block bg-gradient-to-b from-white via-white/90 to-white/45 bg-clip-text text-transparent">
          {line2Visible}
          {showCursor && charCount > line1Length ? (
            <span className="ml-px inline-block text-orange-400">▍</span>
          ) : null}
        </span>
      )}
    </h1>
  );
}
