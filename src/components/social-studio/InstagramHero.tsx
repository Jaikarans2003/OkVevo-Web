'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Image from 'next/image';
import { Zap, ArrowRight } from 'lucide-react';

const InstagramHero = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    // Scroll-based parallax
    const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);

    const scrollToTrends = () => {
        const section = document.getElementById('trends');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section
            ref={containerRef}
            className="relative h-screen w-full overflow-hidden bg-[#0A0A0A] flex flex-col items-center justify-center pt-32 pb-20"
        >
            {/* Background Image - Scroll Parallax */}
            <motion.div
                style={{ y, scale }}
                className="absolute inset-0 z-0 select-none pointer-events-none flex items-center justify-center mix-blend-screen"
            >
                <div className="relative w-screen h-screen rotate-180">
                    <Image
                        src="/images/bgg.png"
                        alt="Neural Interaction"
                        fill
                        className="object-fit"
                        priority
                    />
                </div>
            </motion.div>

            {/* Overlays for depth and contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-[#0A0A0A]/60 z-[1] pointer-events-none" />

            {/* Content Container (Centered Stack) */}
            <motion.div
                style={{ opacity }}
                className="relative z-20 container mx-auto px-8 flex flex-col items-center text-center"
            >
                {/* Heading Stack */}
                <div className="flex flex-col items-center gap-6 mb-12">
                    <h1 className="text-[3.5rem] md:text-[5rem] lg:text-[7.2rem] font-bold text-white leading-[1.05] tracking-tight">
                        Sculpt the next <br />
                        Viral Wave
                    </h1>

                    <p className="text-white/40 text-lg md:text-xl max-w-xl font-medium  leading-relaxed">
                        Transform shifting trends into cinematic masterpieces. <br className="hidden md:block" />
                        AI-powered synthesis for the next generation of social creators.
                    </p>
                </div>

                {/* Pill CTA Group */}
                <div className="flex flex-col md:flex-row items-center gap-6 mb-24">
                    <button
                        onClick={scrollToTrends}
                        className="group h-16 px-10 rounded-full bg-white flex items-center gap-4 hover:scale-105 transition-all shadow-[0_0_50px_-10px_rgba(255,255,255,0.3)]"
                    >
                        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                            <Zap size={16} className="text-white" />
                        </div>
                        <span className="text-black font-black uppercase tracking-widest text-[11px]">Start Sculpting</span>
                    </button>
                </div>

                {/* Trust Section */}
                <div className="flex flex-col items-center gap-8">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 italic">
                        Trusted by industry leaders
                    </span>
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-40">
                        <div className="text-xl text-white font-black italic tracking-tighter">ZAPIER</div>
                        <div className="text-xl text-white font-black italic tracking-tighter">WEBFLOW</div>
                        <div className="text-xl text-white font-black italic tracking-tighter">SLACK</div>
                        <div className="text-xl text-white font-black italic tracking-tighter">HUBSPOT</div>
                        <div className="text-xl text-white font-black italic tracking-tighter">FIVERR.</div>
                    </div>
                </div>
            </motion.div>
        </section>
    );
};

export default InstagramHero;
