'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const STEPS = [
    {
        kicker: 'Ask',
        body: 'Message Nia the way you’d message a colleague.',
    },
    {
        kicker: 'She works',
        body: 'She works in the background and comes back with it done.',
    },
    {
        kicker: 'She remembers',
        body: 'Your clients, your formats, your way. Less explaining every week.',
    },
]

function ScaledFrame({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const apply = () => {
            const width = el.clientWidth
            setScale(width < 360 ? width / 360 : 1)
        }
        apply()
        const observer = new ResizeObserver(apply)
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={ref} className="w-full">
            <div style={{ height: 470 * scale }}>
                <div
                    style={{
                        width: scale < 1 ? 360 : '100%',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    )
}

export function AppWindow({ step }: { step: number }) {
    return (
        <div className="overflow-hidden rounded-[24px] border border-black/40 bg-[#2b2b2b] text-[#f4f2ee] shadow-[0_24px_80px_rgba(20,19,17,0.18)]">
            <div className="flex h-10 items-center gap-2 border-b border-white/10 px-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="flex-1 text-center text-xs text-white/70">Nia</span>
            </div>
            <div className="grid min-h-[420px] grid-cols-[112px_1fr]">
                <aside className="border-r border-white/10 bg-[#242424] p-3 text-xs">
                    <p className="text-white/40">Sessions</p>
                    <p className="mt-3 rounded-lg bg-white/10 px-2 py-2">Sharma Traders</p>
                    <p className="mt-2 px-2 text-white/50">New session</p>
                </aside>
                <div className="flex min-w-0 flex-col">
                    <div className="flex flex-1 flex-col gap-3 p-4 text-sm">
                        <div className="ml-auto w-fit max-w-[92%] rounded-[1.5rem] bg-[#2f2f2f] px-4 py-3">
                            Reconcile HDFC statement, Sharma Traders, September
                            <span className="mt-2 block text-xs text-white/50">HDFC-Sep.pdf</span>
                        </div>
                        {step >= 1 ? (
                            <div className="max-w-[95%] text-white/85">
                                <p className="text-xs text-[#ff6d1f]">Working through the statement</p>
                                <table className="mt-3 w-full text-left text-xs">
                                    <tbody>
                                        <tr className="border-b border-white/10">
                                            <td className="py-2">12 Sep · Rent</td>
                                            <td className="py-2 text-right">Matched</td>
                                        </tr>
                                        <tr className="border-b border-white/10">
                                            <td className="py-2">18 Sep · NEFT</td>
                                            <td className="py-2 text-right">Matched</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 text-[#ff6d1f]">3 items flagged</td>
                                            <td className="py-2 text-right text-[#ff6d1f]">Review</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                        {step >= 2 ? (
                            <>
                                <div className="ml-auto w-fit max-w-[92%] rounded-[1.5rem] bg-[#2f2f2f] px-4 py-3">
                                    Same for October
                                </div>
                                <p className="max-w-[95%] text-sm text-white/85">
                                    Using the September layout from this session. October draft is ready for your review.
                                </p>
                            </>
                        ) : null}
                    </div>
                    <div className="m-3 rounded-[1.5rem] border border-white/10 px-4 py-3 text-sm text-white/40">
                        Message Nia
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function SeeNia() {
    const rootRef = useRef<HTMLElement>(null)
    const [step, setStep] = useState(0)

    useEffect(() => {
        const root = rootRef.current
        if (!root) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduce) {
            setStep(2)
            return
        }

        const mobile = window.matchMedia('(max-width: 767px)')
        if (mobile.matches) {
            const nodes = root.querySelectorAll<HTMLElement>('[data-step]')
            const observer = new IntersectionObserver(
                (entries) => {
                    const visible = entries
                        .filter((entry) => entry.isIntersecting)
                        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
                    if (!visible) return
                    setStep(Number((visible.target as HTMLElement).dataset.step))
                },
                { threshold: 0.55 },
            )
            nodes.forEach((node) => observer.observe(node))
            return () => observer.disconnect()
        }

        const ctx = gsap.context(() => {
            ScrollTrigger.create({
                trigger: root,
                start: 'top top',
                end: '+=180%',
                pin: true,
                scrub: 0.4,
                onUpdate: (self) => {
                    const next = self.progress < 0.34 ? 0 : self.progress < 0.67 ? 1 : 2
                    setStep((prev) => (prev === next ? prev : next))
                },
            })
        }, root)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={rootRef} id="how" aria-label="How it works" className="bg-[var(--bg)] px-4 py-20 md:py-0">
            <div className="mx-auto grid max-w-[1120px] items-center gap-8 md:min-h-dvh md:grid-cols-[minmax(0,0.72fr)_minmax(360px,1fr)] md:py-16">
                <div>
                    <p className="text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">How it works</p>
                    <h2 className="nia-display nia-h2 mt-3">This is Nia.</h2>
                    <ol className="mt-8 hidden space-y-6 md:block">
                        {STEPS.map((item, index) => (
                            <li key={item.kicker} className={index === step ? '' : 'opacity-40'}>
                                <p className="text-sm text-[var(--muted)]">{index + 1} · {item.kicker}</p>
                                <p className="mt-1 max-w-[34ch] text-[17px]">{item.body}</p>
                            </li>
                        ))}
                    </ol>
                </div>
                <div className="max-md:sticky max-md:top-16 max-md:z-10 max-md:bg-[var(--bg)] max-md:py-2">
                    <ScaledFrame>
                        <AppWindow step={step} />
                    </ScaledFrame>
                </div>
                <ol className="space-y-8 md:hidden">
                    {STEPS.map((item, index) => (
                        <li key={item.kicker} data-step={index} className="min-h-[32vh]">
                            <p className="text-sm text-[var(--muted)]">{index + 1} · {item.kicker}</p>
                            <p className="mt-2 text-[17px]">{item.body}</p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    )
}
