'use client';

import { useEffect, useRef, useState } from 'react';
import NiaMark from './NiaFace';
import SessionFrame, { type SessionLine } from './SessionFrame';
import type { NiaMood } from './nia-mark';

const STEP_MOOD: NiaMood[] = ['happy', 'work', 'think', 'idle'];

const STEPS: { title: string; body: string; lines: SessionLine[] }[] = [
    {
        title: 'Ask',
        body: 'Open a session and say what you want done.',
        lines: [{ role: 'you', text: 'Sort the downloads folder and leave a note of what changed.' }],
    },
    {
        title: 'Act',
        body: 'She calls tools on that machine: files, the terminal, the browser, and search.',
        lines: [
            { role: 'nia', text: 'Reading the folder. I can move files and write the note.' },
            { role: 'note', text: 'Using files on this computer', tone: 'slate' },
        ],
    },
    {
        title: 'Approve',
        body: 'Anything that changes the computer waits until you allow it.',
        lines: [
            { role: 'nia', text: 'Nothing moves until you allow it.' },
            { role: 'note', text: 'Waiting for approval', tone: 'ochre' },
        ],
    },
    {
        title: 'Keep',
        body: 'The session stays on the computer. Model use is metered on your OkVevo account.',
        lines: [
            { role: 'nia', text: 'Done. The note is on your desktop.' },
            { role: 'note', text: 'Allowed', tone: 'moss' },
            { role: 'note', text: 'Model use is on your OkVevo account', tone: 'petrol' },
        ],
    },
];

export default function HowNiaWorks() {
    const [active, setActive] = useState(0);
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (!visible) return;
                setActive(Number((visible.target as HTMLElement).dataset.step));
            },
            { threshold: [0.55] },
        );
        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, []);

    return (
        <section ref={ref} id="how" aria-labelledby="how-title" className="scroll-mt-24 bg-[#f6f1ec] text-[#2b2b2b]">
            <div className="mx-auto grid max-w-[1120px] gap-8 px-6 py-28 md:grid-cols-2 md:gap-16 md:px-10 md:py-36">
                <div className="md:sticky md:top-28 md:self-start">
                    <NiaMark mood={STEP_MOOD[active] ?? 'idle'} className="mb-8 w-28 md:w-36" />
                    <h2 id="how-title" className="max-w-[12ch] text-5xl font-medium leading-[1.02] tracking-tight md:text-7xl">
                        How a session goes
                    </h2>
                    <ol className="mt-10 space-y-3">
                        {STEPS.map((step, index) => (
                            <li key={step.title}>
                                    <p className={`text-2xl font-medium tracking-tight transition-colors duration-300 ${active === index ? 'text-[#2b2b2b]' : 'text-[#2b2b2b]/35'}`}>
                                    {step.title}
                                </p>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-6 max-w-[36ch] text-lg leading-relaxed text-[#2b2b2b]/70">{STEPS[active].body}</p>
                </div>
                <div>
                    {STEPS.map((step, index) => (
                        <article key={step.title} data-step={index} className="flex min-h-[70vh] items-center py-10 md:min-h-[80vh]">
                            <div className="w-full">
                                <SessionFrame label={step.title} lines={step.lines} />
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
