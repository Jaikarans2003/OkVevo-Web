'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let landingScroll: Lenis | null = null

export function scrollLandingTo(y: number) {
    if (landingScroll) landingScroll.scrollTo(y, { immediate: true, force: true })
    else window.scrollTo(0, y)
}

export function holdLandingScroll(hold: boolean) {
    if (!landingScroll) return
    if (hold) landingScroll.stop()
    else landingScroll.start()
}

export default function SmoothScroll() {
    useEffect(() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;

        const lenis = new Lenis({
            duration: 1.05,
            lerp: 0.1,
            smoothWheel: true,
        });
        landingScroll = lenis

        lenis.on('scroll', ScrollTrigger.update);
        const tick = (time: number) => {
            lenis.raf(time * 1000);
        };
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        ScrollTrigger.refresh();

        return () => {
            gsap.ticker.remove(tick);
            if (landingScroll === lenis) landingScroll = null
            lenis.destroy();
        };
    }, []);

    return null;
}
