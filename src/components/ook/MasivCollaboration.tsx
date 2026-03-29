'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const MasivCollaboration = () => {
    return (
        <section className="relative h-screen bg-black overflow-hidden flex flex-col items-center justify-center font-sans">
            {/* Background Image with Black Filter */}
            <div className="absolute inset-0 z-0 transform-gpu">
                <img
                    src="/bgimage.png"
                    alt="OKVEVO X MASIV Background"
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
                {/* Black Filter (Overlay) */}
                <div className="absolute inset-0 bg-black/30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />
            </div>
 
            <div className="relative z-10 text-center px-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center"
                >
                    <div className=" -translate-y-[25vh]">
                        <p className="text-white/80 mb-4">
                            OKVEVO x MASIV
                        </p>
                        <p className="text-1xl md:text-2xl font-black tracking-tighter text-white leading-none">
                            "Enter the booth and <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-600 to-red-800">transform yourself</span> with AI."
                        </p>
                        <Link href="/location">
                        <button className=" mt-10 px-6 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                            See Our Location
                        </button>
                    </Link>  
                    </div>
                                    
                </motion.div>
            </div>

            {/* Side Accents - To make it 'Awesome' */}
            <div className="absolute inset-0 pointer-events-none z-20">
                {/* Left Side Label */}
                <div className="absolute left-10 top-1/2 -translate-y-1/2 rotate-180 [writing-mode:vertical-lr] flex items-center gap-4">
                    <div className="w-[1px] h-20 bg-gradient-to-t from-white/20 to-transparent" />
                    <span className="text-[10px] text-white/30 font-black tracking-[0.5em] uppercase">
                        Aesthetic Protocol // 001
                    </span>
                </div>

                {/* Right Side Label */}
                <div className="absolute right-10 top-1/2 -translate-y-1/2 [writing-mode:vertical-lr] flex items-center gap-4">
                    <span className="text-[10px] text-white/30 font-black tracking-[0.5em] uppercase">
                        OKVEVO x MASIV // Global
                    </span>
                    <div className="w-[1px] h-20 bg-gradient-to-b from-white/20 to-transparent" />
                </div>

                {/* Tiny corner brackets for technical feel */}
                <div className="absolute top-20 left-20 w-8 h-8 border-t border-l border-white/10" />
                <div className="absolute top-20 right-20 w-8 h-8 border-t border-r border-white/10" />
                <div className="absolute bottom-20 left-20 w-8 h-8 border-b border-l border-white/10" />
                <div className="absolute bottom-20 right-20 w-8 h-8 border-b border-r border-white/10" />
            </div>
        </section>
    );
};

export default MasivCollaboration;
