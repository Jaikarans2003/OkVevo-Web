'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Link from 'next/link';

export type FaqItem = { question: string; answer: string }

export default function Faq({ items }: { items: FaqItem[] }) {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
            <section id="faq" aria-label="Frequently asked questions" className="mx-auto grid w-full max-w-[1120px] gap-12 px-6 py-24 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-16 md:px-8">
                <div className="md:sticky md:top-28 md:self-start">
                    <h2 className="nia-display nia-h2">FAQ</h2>
                    <p className="mt-4 max-w-sm text-[1.0625rem] leading-relaxed text-[var(--muted)]">
                        She’s a full personal agent. Accounting is her profession, not her limit.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 text-sm">
                        <a className="inline-flex w-fit rounded-full border border-[var(--line)] px-4 py-2 hover:border-[#2A2A2A]" href="mailto:info@azonovatechnologies.com">
                            Email us
                        </a>
                        <Link className="inline-flex w-fit rounded-full border border-[var(--line)] px-4 py-2 hover:border-[#2A2A2A]" href="/login">
                            Sign in
                        </Link>
                    </div>
                </div>
                <div>
                    {items.map((item, i) => {
                        const isOpen = openIndex === i;
                        return (
                            <div key={item.question} className="border-b border-[var(--line)]">
                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(isOpen ? null : i)}
                                    className="flex w-full items-start gap-4 py-5 text-left"
                                    aria-expanded={isOpen}
                                >
                                    <span className="mt-0.5 w-8 shrink-0 text-sm tabular-nums text-[var(--muted)]">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="flex-1 text-[17px] font-medium">{item.question}</h3>
                                    <span className="text-[var(--muted)]">{isOpen ? <Minus size={16} /> : <Plus size={16} />}</span>
                                </button>
                                {isOpen ? (
                                    <p className="pb-5 pl-12 text-[17px] leading-relaxed text-[var(--muted)]">{item.answer}</p>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </section>
        </>
    );
}
