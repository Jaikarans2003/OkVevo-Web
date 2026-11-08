'use client';

import type { CSSProperties } from 'react';
import './loading-screen.css';

const LOGO_SRC = '/OKVEVO%20Logos%20WithOut%20BackGrounds/Orange.svg';

// What OkVevo is, drawn in ink: the core in the middle, a line out to each of the five pillars it runs,
// a ring joining them, then work flowing from every pillar back into the core.
// Strokes draw on via pathLength=1 + dashoffset (loading-screen.css); `--d` is each piece's start in seconds.
const CX = 240, CY = 200, R = 132, NODE = 28, CORE = 46;
const r1 = (n: number) => Math.round(n * 10) / 10;
const PILLARS = [
    { name: 'Technology', ink: 'var(--l-teal)', icon: 'M-9 -8 L-16 0 L-9 8 M9 -8 L16 0 L9 8 M4 -11 L-4 11' },
    { name: 'Finance', ink: 'var(--l-ochre)', icon: 'M-12 11 V3 M-4 11 V-3 M4 11 V-7 M12 11 V-12' },
    { name: 'Marketing', ink: 'var(--l-rust)', icon: 'M-12 -4 H-4 L8 -11 V11 L-4 4 H-12 Z M-8 4 L-5 12' },
    { name: 'Sales', ink: 'var(--l-olive)', icon: 'M-13 -9 H13 V5 H-2 L-9 11 V5 H-13 Z' },
    { name: 'Operations', ink: 'var(--l-slate)', icon: 'M-11 -11 H11 V11 H-11 Z M-6 0 L-2 4 L6 -5' },
].map((p, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const c = Math.cos(a), s = Math.sin(a);
    const x = CX + R * c, y = CY + R * s;
    const from = { x: CX + c * (CORE + 6), y: CY + s * (CORE + 6) };
    const to = { x: x - c * (NODE + 6), y: y - s * (NODE + 6) };
    const side = Math.abs(s) < 0.5;   // side pillars are labelled beside their circle, top and bottom ones above/below
    const lx = side ? x + c * (NODE + 10) : x + c * 54;
    const ly = side ? y + 5 : y + s * 54 + 5;
    const anchor: 'start' | 'end' | 'middle' = side ? (c > 0 ? 'start' : 'end') : 'middle';
    return { ...p, x: r1(x), y: r1(y), from, to, lx: r1(lx), ly: r1(ly), anchor, t: 0.45 + i * 0.12 };
});
const at = (d: number, extra?: CSSProperties) => ({ '--d': `${d}s`, ...extra } as CSSProperties);

function OkVevoSystem() {
    return (
        <svg viewBox="-30 0 540 400" className="ok-loader__system">
            <circle cx={CX} cy={CY} r={R} pathLength={1} className="s orbit" style={at(1.35)} />
            {PILLARS.map((p) => (
                <path key={p.name} d={`M${r1(p.from.x)} ${r1(p.from.y)} L${r1(p.to.x)} ${r1(p.to.y)}`} pathLength={1} className="s spoke" style={at(p.t)} />
            ))}
            {PILLARS.map((p, i) => (
                <circle key={p.name} cx={r1(p.to.x)} cy={r1(p.to.y)} r={4.5} className="flow"
                    style={at(1.9 + i * 0.28, { '--dx': `${r1(p.from.x - p.to.x)}px`, '--dy': `${r1(p.from.y - p.to.y)}px` } as CSSProperties)} />
            ))}
            {PILLARS.map((p) => (
                <g key={p.name} transform={`translate(${p.x} ${p.y})`}>
                    <circle r={NODE} className="nd" style={at(p.t + 0.2)} />
                    <circle r={NODE} pathLength={1} className="s ring" style={at(p.t + 0.15, { stroke: p.ink })} />
                    <path d={p.icon} pathLength={1} className="s ic" style={at(p.t + 0.35)} />
                </g>
            ))}
            {PILLARS.map((p) => (
                <text key={p.name} x={p.lx} y={p.ly} textAnchor={p.anchor} className="lbl" style={at(p.t + 0.45)}>{p.name}</text>
            ))}
            <circle cx={CX} cy={CY} r={CORE} className="core-glow" style={at(2)} />
            <circle cx={CX} cy={CY} r={CORE} className="core" style={at(0.1)} />
            <circle cx={CX} cy={CY} r={CORE} pathLength={1} className="s" style={at(0)} />
            <image href={LOGO_SRC} x={CX - 32} y={CY - 32} width={64} height={64} className="core-logo" style={at(0.3)} />
        </svg>
    );
}

interface LoadingScreenProps {
    fadingOut?: boolean;
    onFadeComplete?: () => void;
    loadKey?: string;
    /** full: the first-page animation (AppLoadingGate). quick: paper at once, a small mark only if the wait drags on. */
    variant?: 'full' | 'quick';
}

export default function LoadingScreen({ fadingOut = false, onFadeComplete, variant = 'quick' }: LoadingScreenProps) {
    const full = variant === 'full';
    return (
        <div
            className={`ok-loader ok-loader--${variant}${fadingOut ? ' ok-loader--out' : ''}`}
            role="status"
            aria-live="polite"
            onTransitionEnd={(event) => {
                if (fadingOut && event.target === event.currentTarget && (event.propertyName === 'transform' || event.propertyName === 'opacity')) onFadeComplete?.();
            }}
        >
            <div className="ok-loader__inner" aria-hidden="true">
                {full ? (
                    <>
                        <OkVevoSystem />
                        <p className="ok-loader__tag">The AI business operating system</p>
                    </>
                ) : (
                    <div className="ok-loader__mark">
                        <img className="ok-loader__logo" src={LOGO_SRC} width={500} height={500} alt="" />
                        <svg className="ok-loader__rule" viewBox="0 0 120 12"><path d="M4 7 C30 2 50 11 70 6 S104 4 116 7" pathLength={1} /></svg>
                    </div>
                )}
            </div>
            <span className="ok-loader__label">Loading OkVevo</span>
        </div>
    );
}
