'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import Image from 'next/image';
import { env } from '@/config/env';

interface HeroProps {
    onJoinClick: () => void;
}


const Hero = ({ onJoinClick }: HeroProps) => {
    const containerRef = useRef<HTMLElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const marketingVideoUrl = env.marketingVideoUrl;

    return (
        <section ref={containerRef} className="relative min-h-[140vh] bg-black overflow-hidden flex flex-col items-center">

            {/* --- Background Elements --- */}

            {/* Background Image Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-70">
                <Image
                    src="/images/herobg.png"
                    alt="OKVEVO Cinematic Background"
                    fill
                    priority
                    fetchPriority="high"
                    sizes="100vw"
                    className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black" />
            </div>

            {/* Technical Grid Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
                    backgroundSize: '60px 60px'
                }}
            />

            {/* The Arc Glow */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, delay: 1 }}
                className="absolute top-[-450px] left-1/2 -translate-x-1/2 w-[1600px] h-[800px] flex items-center justify-center pointer-events-none"
            >
                {/* Thin Arc Line */}
                <div className="absolute bottom-0 w-[1400px] h-[1400px] border-[1px] border-accent-orange/10 rounded-full mask-arc" />
                {/* Glow Spread */}
                <div className="absolute bottom-0 w-[800px] h-[400px] bg-accent-orange/5 blur-3xl rounded-full translate-y-20 transform-gpu" />
            </motion.div>

            {/* --- Content Section --- */}

            <div className="relative z-10 mt-10 pt-32 px-6 flex flex-col items-center text-center max-w-5xl mx-auto">

                {/* Main Headline */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    className="text-5xl md:text-8xl font-bold tracking-tight text-white mb-6 leading-[1.05]"
                >
                    Turn your lecture<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">into a visual lesson.</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                    className="text-lg md:text-xl text-white/50 max-w-2xl mb-12 font-medium"
                >
                    Meet Nia, your AI teaching assistant that transforms lectures,
                    lessons, and training sessions into polished educational videos.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="flex flex-col sm:flex-row items-center gap-4 mb-20"
                >
                    <button
                        onClick={onJoinClick}
                        className="btn-premium text-black bg-white px-10 py-5"
                    >
                        Get started
                    </button>
                    <a
                        href="#showcase"
                        className="btn-outline-pro px-10 py-5 flex items-center gap-2 group text-white border-white/20 hover:border-accent-orange"
                    >
                        <Play className="w-5 h-5 fill-white group-hover:fill-accent-orange transition-colors" />
                        Watch Demo
                    </a>
                </motion.div>


            </div>

            {/* --- Bottom Video Section --- */}

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 100 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
                className="relative w-full max-w-6xl px-4 md:px-0 mx-auto group"
            >
                {/* Visual Accent Glow behind container */}
                <div className="absolute -inset-4 bg-accent-orange/20 blur-3xl rounded-[4rem] group-hover:bg-accent-orange/30 transition-all duration-700 pointer-events-none transform-gpu" />

                <div className="relative rounded-[3rem] md:rounded-[2rem] overflow-hidden border border-white/10 bg-black/60 shadow-2xl transition-transform duration-700 hover:scale-[1.01]">
                    <div className="aspect-[16/9] w-full">
                        <div className="absolute inset-0">
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover"
                                src={marketingVideoUrl || undefined}
                                suppressHydrationWarning
                            />
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                        </div>
                    </div>
                </div>
            </motion.div>


            <style jsx>{`
                .mask-arc {
                    mask-image: linear-gradient(to top, transparent 50%, black 100%);
                    -webkit-mask-image: linear-gradient(to top, transparent 50%, black 100%);
                }
            `}</style>
        </section>
    );
};

export default Hero;