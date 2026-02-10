'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface HeroProps {
    onJoinClick: () => void;
}

const Hero = ({ onJoinClick }: HeroProps) => {
    return (
        <section className="relative min-h-screen bg-white pt-48 pb-20 overflow-hidden flex flex-col items-center">
            {/* Background Decorative Gradients */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <motion.div
                    initial={{ scale: 1, opacity: 0.35, x: 0, y: 0 }}
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.35, 0.5, 0.35],
                        x: [0, 50, 0],
                        y: [0, -30, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] bg-accent-orange blur-[140px] rounded-full opacity-[0.35]"
                />
                <motion.div
                    initial={{ scale: 1, opacity: 0.25, x: 0, y: 0 }}
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.25, 0.4, 0.25],
                        x: [0, -40, 0],
                        y: [0, 60, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] bg-accent-orange blur-[120px] rounded-full opacity-25"
                />
            </div>

            {/* Massive Cuberto-style Heading */}
            <div className="container relative z-10 flex flex-col items-center text-center px-6 mb-20">
                <motion.h1
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-[12vw] md:text-[10vw] font-black leading-[0.85] tracking-[-0.06em] text-text-main max-w-[12ch] relative"
                >
                    Your identity <br />
                    <span className="text-accent-orange text-cursive text-[1.0em] font-normal inline-block translate-y-2">unleashed.</span>
                </motion.h1>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-12 max-w-2xl"
                >
                    <p className="text-xl md:text-2xl text-text-dim/80 font-medium leading-tight">
                        OKVEVO is a digital laboratory focused on high-fidelity AI
                        avatars, cinematic storytelling, and cutting-edge neural
                        rendering.
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
                            className="relative"
                        >
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border border-white/30 backdrop-blur-md flex items-center justify-center">
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
                    <div className="w-16 h-16 rounded-full border border-text-main flex items-center justify-center group-hover:bg-accent-orange group-hover:border-accent-orange group-hover:text-white transition-all duration-500">
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
                    <p className="text-text-dim/60 font-medium max-w-sm ml-auto">
                        Our technology allows creators to bypass traditional production
                        bottlenecks and focus purely on the vision.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default Hero;
