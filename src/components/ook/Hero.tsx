'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface HeroProps {
    onJoinClick: () => void;
}

const Hero = ({ onJoinClick }: HeroProps) => {
    return (
        <section data-section-theme="light" className="relative min-h-screen bg-bg-main pt-48 pb-20 overflow-hidden flex flex-col items-center">
            {/* Background Orange Glow */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] bg-accent-orange/15 blur-[160px] rounded-full" />
            </div>

            {/* Background elements removed to restore clean white look */}

            {/* Background Decorative Gradients */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <motion.div
                    initial={{ scale: 1, opacity: 0.3, x: 0, y: 0 }}
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.4, 0.3],
                        x: [0, 20, 0],
                        y: [0, -15, 0]
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] bg-accent-orange blur-[140px] rounded-full opacity-[0.3] transform-gpu"
                />
                <motion.div
                    initial={{ scale: 1, opacity: 0.2, x: 0, y: 0 }}
                    animate={{
                        scale: [1, 1.15, 1],
                        opacity: [0.2, 0.3, 0.2],
                        x: [0, -20, 0],
                        y: [0, 30, 0]
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear", delay: 2 }}
                    className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] bg-accent-orange blur-[120px] rounded-full opacity-20 transform-gpu"
                />
                {/* Symmetrical left-side balance glow */}
                <motion.div
                    initial={{ scale: 1, opacity: 0.1, x: 0, y: 0 }}
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.1, 0.2, 0.1],
                        x: [0, 15, 0],
                        y: [0, 20, 0]
                    }}
                    transition={{ duration: 16, repeat: Infinity, ease: "linear", delay: 1 }}
                    className="absolute -bottom-[15%] -left-[5%] w-[45vw] h-[45vw] bg-accent-orange/40 blur-[100px] rounded-full opacity-15 transform-gpu"
                />
                <motion.div
                    animate={{
                        x: [0, -15, 0],
                        y: [0, 25, 0],
                        scale: [1, 1.05, 1]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-1/4 left-1/3 w-[40vw] h-[40vw] bg-accent-orange/10 blur-[120px] rounded-full opacity-[0.15] transform-gpu"
                />
            </div>

            {/* Massive Cuberto-style Heading */}
            <div className="container relative z-10 flex flex-col items-center text-center px-6 mb-20">
                <motion.h1
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-[12vw] md:text-[10vw] leading-[0.85] tracking-[-0.06em] text-text-main max-w-[12ch] relative"
                    style={{ fontFamily: '"MuseoModerno"', fontOpticalSizing: 'auto', fontWeight: 700 }}
                >
                    Zero Canvas, Infinite Vision
                </motion.h1>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-12 max-w-2xl"
                >
                    <p className="text-xl md:text-2xl text-text-dim font-medium leading-tight">
                        Turn ideas into stories that move.
                    </p>
                </motion.div>
            </div>

            {/* Large Central Visual - Wide Container */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 1.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="container px-6 md:px-12 w-full"
            >
                <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-[40px] md:rounded-[80px] overflow-hidden group shadow-2xl">
                    <Image
                        src="/movie-scene.png"
                        alt="AI Powered Cinema"
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

                    {/* Floating Badge (Extra Design Touch) */}
                    <div className="absolute bottom-8 right-8 md:bottom-16 md:right-16 z-20">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="relative transform-gpu"
                        >
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border border-white/30 bg-white/10 flex items-center justify-center">
                                <Image
                                    src="/avatar.png"
                                    alt="Badge Avatar"
                                    width={80}
                                    height={80}
                                    className="w-16 h-16 md:w-20 md:h-20 object-contain"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Sub-description Grid below visual */}
            <div className="container px-6 md:px-12 mt-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
                <motion.div
                    whileHover={{ x: 10 }}
                    onClick={onJoinClick}
                    className="flex items-center gap-6 cursor-pointer group"
                >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:bg-accent-orange group-hover:border-accent-orange group-hover:text-white transition-all duration-500">
                        <ArrowRight size={24} />
                    </div>
                    <div>
                        <p className="text-xl font-bold tracking-tight text-text-main">
                            Start Your <br /> Digital Journey
                        </p>
                        <span className="text-[10px] font-black tracking-widest uppercase text-accent-orange opacity-0 group-hover:opacity-100 transition-opacity">Apply Now</span>
                    </div>
                </motion.div>
                <div className="text-left md:text-right">
                    <p className="text-text-dim/72 font-medium max-w-sm ml-auto">
                        Our technology allows creators to bypass traditional production
                        bottlenecks and focus purely on the vision.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default Hero;
