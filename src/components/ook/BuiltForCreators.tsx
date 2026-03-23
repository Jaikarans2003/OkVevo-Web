'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Cpu, Orbit } from 'lucide-react';

const KineticVision = () => {
    return (
        <section className="relative h-[900px] w-full bg-black overflow-hidden flex flex-col items-center justify-center py-20">
            
            {/* --- CORE KINETIC BACKGROUND --- */}
            
            {/* Floating Orbs / Vision Spheres */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Large Center Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent-orange/5 blur-[160px] rounded-full" />
                
                {/* Orbital Rings */}
                {[1, 2, 3].map((i) => (
                    <motion.div
                        key={i}
                        animate={{ 
                            rotate: 360,
                            scale: [1, 1.05, 1]
                        }}
                        transition={{ 
                            rotate: { duration: 20 + i * 10, repeat: Infinity, ease: "linear" },
                            scale: { duration: 8, repeat: Infinity, ease: "easeInOut" }
                        }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.03]"
                        style={{ 
                            width: `${400 + i * 200}px`, 
                            height: `${400 + i * 200}px`,
                        }}
                    />
                ))}
            </div>

            {/* Grid Mesh */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
                }}
            />

            {/* --- MAIN CONTENT --- */}
            
            <div className="relative z-10 text-center px-6 max-w-5xl mx-auto space-y-12">
                
                {/* The "Neural" Pill */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-3 px-6 py-2 bg-white/[0.02] backdrop-blur-3xl border border-white/5 rounded-full"
                >
                    <Cpu className="w-3.5 h-3.5 text-accent-orange" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Powered by Neural Vision</span>
                </motion.div>

                {/* Kinetic Heading */}
                <motion.h2
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    viewport={{ once: true }}
                    className="text-6xl md:text-9xl font-black tracking-tighter text-white leading-[0.9]"
                >
                    Beyond <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/20 italic">Imagination.</span>
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    viewport={{ once: true }}
                    className="text-lg md:text-xl text-white/30 max-w-2xl mx-auto font-medium leading-relaxed tracking-wide"
                >
                    We're not just building tools; we're crafting the future of digital existence. A seamless fusion of light, logic, and limitless creativity.
                </motion.p>

                {/* Interactive Visual Element: The Vision Pulse */}
                <div className="relative pt-10">
                    <div className="flex justify-center items-center gap-8 md:gap-16">
                        {[
                            { icon: <Zap />, label: 'SPEED' },
                            { icon: <Orbit />, label: 'FLUID' },
                            { icon: <Sparkles />, label: 'PURE' }
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.6 + i * 0.15 }}
                                viewport={{ once: true }}
                                whileHover={{ y: -8 }}
                                className="group flex flex-col items-center gap-4"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/20 group-hover:text-accent-orange group-hover:border-accent-orange/30 group-hover:bg-accent-orange/5 transition-all duration-500 shadow-2xl">
                                    {React.isValidElement(item.icon) && React.cloneElement(item.icon as React.ReactElement<any>, { size: 24, strokeWidth: 1.5 })}
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/10 group-hover:text-white/40 transition-colors">
                                    {item.label}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>

            </div>

            {/* --- GRAVITY LINES --- */}
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-32 bg-gradient-to-t from-accent-orange to-transparent opacity-40" />

        </section>
    );
};

export default KineticVision;
