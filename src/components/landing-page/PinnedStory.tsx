'use client'

import NiaHeroApp from './nia-app/NiaHeroApp'

export default function PinnedStory() {
    return (
        <section className="nia-story bg-[var(--bg)]" aria-label="Meet Nia">
            <div className="scene-hero nia-scene">
                <div className="hero-copy">
                    <h1 className="nia-display nia-h1">Meet Nia</h1>
                    <p className="hero-lead mt-4 max-w-[22ch]">
                        All-rounder by nature. Accountant by profession.
                    </p>
                    <p className="mt-5 max-w-[36rem] text-[1.0625rem] leading-normal">
                        Your personal AI agent for everyday work — and the accounts work your firm does every month.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-start gap-4">
                        <a className="nia-btn" href="#pricing">Get early access</a>
                        <a className="nia-btn nia-btn-ghost" href="#how">See her work</a>
                    </div>
                    <p className="hero-hint mt-10 text-xs tracking-[0.06em] text-[var(--muted)] uppercase">Scroll</p>
                </div>
                <div className="hero-mock">
                    <div className="hero-glow" aria-hidden />
                    <NiaHeroApp />
                </div>
            </div>
        </section>
    )
}
