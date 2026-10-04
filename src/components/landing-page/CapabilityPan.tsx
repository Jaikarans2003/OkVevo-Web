'use client';

import SessionFrame, { type SessionLine } from './SessionFrame';

const ITEMS: { title: string; body: string; tag: string; lines: SessionLine[] }[] = [
    {
        title: 'Sessions',
        body: 'Talk to her in a chat that stays on your computer.',
        tag: 'On this machine',
        lines: [{ role: 'you', text: 'Where did I leave the launch notes?' }],
    },
    {
        title: 'Tools',
        body: 'She can read files, run the terminal, browse, and search.',
        tag: 'Files, terminal, browser',
        lines: [
            { role: 'nia', text: 'I found the notes in Downloads and the matching thread in the browser.' },
        ],
    },
    {
        title: 'Skills',
        body: 'Load a skill when the job already has a way of working.',
        tag: 'A known way of working',
        lines: [{ role: 'note', text: 'Skill loaded', tone: 'moss' }],
    },
    {
        title: 'The screen',
        body: 'With your approval, she can see the screen and use the apps on it.',
        tag: 'Only with approval',
        lines: [{ role: 'note', text: 'Waiting for approval', tone: 'ochre' }],
    },
    {
        title: 'Beyond the window',
        body: 'Reach her from a connected messaging app, or leave work on a schedule.',
        tag: 'Messages and schedule',
        lines: [{ role: 'note', text: 'Scheduled on this computer', tone: 'petrol' }],
    },
];

export default function CapabilityPan() {
    return (
        <section id="capabilities" className="scroll-mt-24 bg-[#f6f1ec] px-6 pb-28 pt-36 text-[#2b2b2b] md:px-10 md:pb-36 md:pt-44">
            <div className="mx-auto max-w-[1120px]">
                <h2 className="max-w-[12ch] text-5xl font-medium leading-[1.02] tracking-tight md:text-7xl">
                    What she can do
                </h2>
                <div className="mt-16 divide-y divide-[#2b2b2b]/10 border-t border-[#2b2b2b]/10">
                    {ITEMS.map((item, index) => (
                        <article
                            key={item.title}
                            className="nia-rise grid items-center gap-10 py-14 md:grid-cols-2 md:py-20"
                            style={{ animationDelay: `${index * 60}ms` }}
                        >
                            <div>
                                <p className="text-sm text-[#2b2b2b]/45">0{index + 1}</p>
                                <h3 className="mt-3 text-3xl font-medium tracking-tight md:text-5xl">{item.title}</h3>
                                <p className="mt-4 max-w-[36ch] text-lg leading-relaxed text-[#2b2b2b]/70">{item.body}</p>
                                <p className="mt-6 w-fit rounded-full bg-[#5c6d4a] px-3 py-1 text-xs text-[#e3dcd6]">{item.tag}</p>
                            </div>
                            <SessionFrame label={item.title} lines={item.lines} />
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
