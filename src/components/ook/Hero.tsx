'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface HeroProps {
    onJoinClick: () => void;
}


const Hero = ({ onJoinClick }: HeroProps) => {
    const containerRef = useRef<HTMLElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    return (
        <section ref={containerRef} className="relative min-h-[140vh] bg-black overflow-hidden flex flex-col items-center">

            {/* --- Background Elements --- */}

            {/* Background Image Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-70">
                <img
                    src="/images/herobg.png"
                    alt=""
                    className="w-full h-full object-cover"
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

                {/* Feature Badge/Pill */}
                <Link href="/location">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 13 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="mb-8 p-[1px]  rounded-full bg-gradient-to-r from-white/10 via-accent-orange/50 to-white/10 cursor-pointer group hover:scale-105 transition-all duration-300 active:scale-95"
                    >
                        <div className="px-4 py-1.5  rounded-full bg-black/80 backdrop-blur-md flex items-center gap-2 border border-white/5">
                            <span className="px-2 py-0.5  rounded-full bg-accent-orange text-[10px] font-bold text-white uppercase tracking-wider">New</span>
                            <span className="text-sm  text-white/80 font-medium flex items-center gap-1 group-hover:text-white transition-colors">
                                OKVEVO X MASIV Trends are here
                                <ChevronRight className="w-4 h-4 text-accent-orange group-hover:translate-x-0.5 transition-transform" />
                            </span>
                        </div>
                    </motion.div>
                </Link>

                {/* Main Headline */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    className="text-5xl md:text-8xl font-bold tracking-tight text-white mb-6 leading-[1.05]"
                >
                    Zero Cameras, <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Infinite Vision.</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                    className="text-lg md:text-xl text-white/50 max-w-2xl mb-12 font-medium"
                >
                    Powerful AI-driven cinema tools for absolute legends. Supercharge your visual storytelling and reach the world instantly.
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

                <div className="relative rounded-[3rem] md:rounded-[4rem] overflow-hidden border border-white/10 bg-black/60 shadow-2xl transition-transform duration-700 hover:scale-[1.01]">
                    <div className="aspect-[16/9] w-full">
                        <div className="absolute inset-0">
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover"
                                src="https://firebasestorage.googleapis.com/v0/b/text2video-16cbf.firebasestorage.app/o/videoforwebsite%2Fscreenrecord.webm?alt=media&token=9f40e7d5-82a1-4d81-ac12-d3e29dd8ad82"
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