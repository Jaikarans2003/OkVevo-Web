'use client';

import { motion } from 'framer-motion';
import { Sun, ArrowUpRight } from 'lucide-react';

export default function InfluencerHero() {
    return (
        <section className="relative w-full max-w-[1400px] mx-auto bg-[#F2F2F2] rounded-[60px] overflow-hidden p-8 md:p-12 font-sans select-none">
            {/* Top Text Cluster */}
            <div className="flex flex-col gap-1 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-black/90"
                >
                    <span className="text-xl font-medium tracking-tight">: // BRINGING DATA TO REAL LIFE</span>
                </motion.div>
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-7xl md:text-8xl font-black text-black tracking-tighter leading-none"
                >
                    AI-DRIVEN
                </motion.h1>
            </div>

            {/* Central Main Container - Black Box with Cutouts */}
            <div className="relative w-full h-[540px] bg-black rounded-[80px] overflow-hidden group shadow-2xl">
                {/* Video Background */}
                <div className="absolute inset-0 z-0">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover grayscale-[0.2] transition-transform duration-700 group-hover:scale-105"
                        src="https://cdn.pixabay.com/video/2024/01/25/198113-906522636_large.mp4"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-all duration-700" />
                </div>

                {/* Bottom-Left White Poche (Kept for design consistency) */}
                <div className="absolute bottom-0 left-0 w-[280px] h-[160px] bg-[#F2F2F2] rounded-tr-[80px] z-10 p-8 flex flex-col justify-end">
                    <div className="flex items-start gap-4 translate-y-1">
                        <div className="w-12 h-12 rounded-full bg-black/5 border border-black/5 flex items-center justify-center min-w-[48px]">
                            <ArrowUpRight className="w-5 h-5 text-black/20" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-black/30">Dynamic group of experts</p>
                            <p className="text-sm font-bold leading-tight text-black/80">We are at the forefront<br />of AI innovation</p>
                        </div>
                    </div>
                </div>

                {/* Decorative Elements inside Video Area */}
                <div className="relative z-20 h-full w-full p-12 pointer-events-none">
                    {/* Top Left Text */}
                    <div className="max-w-[200px]">
                        <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] leading-relaxed mb-6">
                            WE AIM TO PROVIDE TOOLS THAT ENHANCE PRODUCTIVITY
                        </p>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF0080] to-[#7928CA] p-[1px]">
                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FF0080] to-[#7928CA] blur-[2px] opacity-80" />
                            </div>
                        </div>
                    </div>

                    {/* Bottom Right Tags */}
                    <div className="absolute bottom-12 right-12 flex gap-3">
                        {['Experience design', 'Machine learning', 'v1.1'].map((tag) => (
                            <span key={tag} className="px-5 py-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">
                                {tag}
                            </span>
                        ))}
                    </div>

                    {/* Play Button Mockup in Center */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center cursor-pointer group/play px-1"
                        >
                            <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2" />
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Bottom Right Text Cluster */}
            <div className="flex justify-end mt-12 items-end">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-8"
                >
                    <h2 className="text-7xl md:text-9xl font-black text-black tracking-tighter leading-[0.85] text-right">
                        AUTOMATE<br />YOUR CONTENT
                    </h2>
                    <div className="w-24 h-24 rounded-full bg-black flex items-center justify-center group-hover:rotate-12 transition-transform duration-700 shadow-xl mb-4">
                        <Sun className="w-12 h-12 text-white" />
                    </div>
                </motion.div>
            </div>

            {/* Functional Sidebar Dots */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-20">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 3 ? 'bg-black' : 'bg-black/40'}`} />)}
            </div>
        </section>
    );
}
