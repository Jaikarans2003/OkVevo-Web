'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

const TuneTalez = () => {
    return (
        <section id="tunetalez" data-section-theme="light" className="section-padding overflow-hidden bg-bg-main relative">
            {/* Background Gradient Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-orange/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="centering-container text-center relative z-10">
                <div className="max-w-4xl mb-32">
                    <motion.span
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        className="text-xs font-bold tracking-[0.4em] text-accent-orange uppercase mb-6 block"
                    >
                        The Ecosystem
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-6xl md:text-[120px] font-bold leading-[0.85] tracking-tighter mb-12"
                    >
                        TuneTalez. <br />
                        <span className="text-accent-orange">Powered by OKVEVO.</span>
                    </motion.h2>
                    <p className="text-2xl text-text-dim leading-relaxed mb-16 max-w-2xl mx-auto">
                        Our flagship platform where characters come to life. Discover a new era of interactive storytelling driven by the OKVEVO cinematic engine.
                    </p>
                    <div className="flex justify-center gap-8">
                        <a href="https://tuneeetalez.vercel.app" className="btn-premium">
                            Visit Platform
                            <ArrowUpRight size={24} />
                        </a>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-full max-w-5xl mx-auto"
                >
                    {/* Immersive visual mockup */}
                    <div className="aspect-[16/9] rounded-[48px] overflow-hidden shadow-premium bg-gradient-to-br from-accent-orange/5 via-accent-sky/5 to-accent-lavender/5 relative group">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[200px] opacity-[0.03] font-black select-none text-accent-orange">TT</span>
                        </div>

                        <Image
                            src="/movie-scene.png"
                            alt="TuneTalez Showcase"
                            fill
                            className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000"
                        />

                        {/* Floating UI elements */}
                        <motion.div
                            animate={{ y: [0, -15, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-12 right-12 glass-card p-6 rounded-[32px] border-accent-orange/20"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-accent-orange animate-pulse" />
                                <span className="text-sm font-bold uppercase tracking-widest text-text-main">Live Engine</span>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default TuneTalez;
