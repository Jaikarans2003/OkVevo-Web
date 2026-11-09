'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const LAYER_MS = 420, INK_MS = 700, HOLD_MS = 6000, OUT_MS = 650;

// A code-painted illustration (art/*.py) stacked from its stage layers: layer 0 is opaque,
// each later layer holds only what that stage inked. While in view it loops: the layers ink
// in one by one, hold, fade out and draw again; layers listed in `float` bob throughout.
// Without JS or with reduced motion the finished picture just shows.
export default function DrawnArt({ name, layers, width, height, alt, float = [], className = '' }: {
    name: string; layers: number; width: number; height: number; alt: string; float?: number[]; className?: string;
}) {
    const ref = useRef<HTMLElement>(null);
    const [state, setState] = useState<'idle' | 'armed' | 'on' | 'out'>('idle');

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let visible = false, timer = 0;
        const wait = (ms: number, next: () => void) => { timer = window.setTimeout(next, ms); };
        const cycle = () => {
            setState('on');
            wait(150 + layers * LAYER_MS + INK_MS + HOLD_MS, () => {
                setState('out');
                wait(OUT_MS, () => {
                    setState('armed');
                    wait(80, () => { if (visible) cycle(); else timer = 0; });
                });
            });
        };
        setState('armed');
        const io = new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !timer) cycle();
        }, { threshold: 0.3 });
        io.observe(el);
        return () => { io.disconnect(); clearTimeout(timer); };
    }, [layers]);

    return (
        <figure ref={ref} className={`drawn ${className}`} data-state={state} style={{ aspectRatio: `${width}/${height}` }}>
            {Array.from({ length: layers }, (_, i) => (
                <img key={i} src={`/art/${name}/layer-${i}.webp`} width={width} height={height} alt={i ? '' : alt}
                    className={float.includes(i) ? 'bob' : undefined}
                    style={{ '--i': i, '--b': float.indexOf(i) } as CSSProperties} />
            ))}
        </figure>
    );
}
