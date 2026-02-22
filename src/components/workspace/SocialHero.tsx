'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Image from 'next/image';
import { Star, ChevronRight, Play, Zap, Sparkles, TrendingUp, Layers } from 'lucide-react';

const SocialHero = () => {
    const heroRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

    return (
        <section
            ref={heroRef}
            className="relative min-h-[120vh] flex flex-col items-center justify-start overflow-hidden bg-[#0A0A0A] pt-32"
        >
            {/* Background Visual Artifact - Vertical Light Streaks */}
            <motion.div
                style={{ y, opacity }}
                className="absolute inset-0 z-0"
            >
                <Image
                    src="/images/social-hero-streaks.png"
                    alt="Social Hero Background"
                    fill
                    className="object-cover opacity-60"
                    priority
                />
                {/* Vignette & Gradients */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#0A0A0A]" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/80" />
            </motion.div>

            {/* Content Wrapper */}
            <div className="relative z-10 w-full max-w-7xl px-8 flex flex-col items-center text-center">

                {/* Trust Indicator / Social Proof */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-2 mb-10"
                >
                    <div className="flex -space-x-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-[#DFFF00]/20 overflow-hidden bg-white/10 relative">
                                <Image src={`https://i.pravatar.cc/100?img=${i + 15}`} alt="user" fill className="object-cover" />
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={10} fill="#DFFF00" className="text-[#DFFF00]" />)}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                            1,000+ creators joined
                        </span>
                    </div>
                </motion.div>

                {/* Centered Heading */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="max-w-4xl mb-8"
                >
                    <h1 className="text-5xl md:text-8xl font-black leading-[0.9] tracking-tighter uppercase text-white shadow-2xl">
                        Trends That Work, <br />
                        <span className="text-white/20">AI That Wows</span>
                    </h1>
                </motion.div>

                {/* Subtext */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm md:text-lg text-white/40 max-w-xl font-medium mb-12 leading-relaxed"
                >
                    We design and develop high-performing, visually stunning social loops that
                    elevate your personal brand and grow your presence.
                </motion.p>

                {/* Glassmorphic CTA */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="group relative h-16 px-12 rounded-full flex items-center justify-center gap-3 overflow-hidden"
                >
                    {/* Glass Effect */}
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-2xl border border-white/10 group-hover:bg-white/10 transition-all duration-500 rounded-full" />
                    {/* Glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#DFFF00]/0 via-[#DFFF00]/20 to-[#DFFF00]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl" />

                    <span className="relative text-xs font-black uppercase tracking-[0.3em] text-white">
                        Get Your Viral Loop &rarr;
                    </span>
                </motion.button>
            </div>

            {/* Brand / Capability Strip */}
            <div className="relative z-10 w-full mt-24 border-y border-white/5 py-8 bg-black/20 backdrop-blur-sm">
                <div className="max-w-[1400px] mx-auto px-8 flex flex-wrap justify-center gap-8 md:gap-16">
                    {[
                        { icon: Zap, label: 'Expansion' },
                        { icon: Sparkles, label: 'Neural Glow' },
                        { icon: TrendingUp, label: 'CyberFlow' },
                        { icon: Layers, label: 'Ultra Recap' },
                        { icon: Play, label: 'Fast Move' }
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-white/40 hover:text-white transition-colors cursor-default grayscale hover:grayscale-0">
                            <item.icon size={18} className="text-white" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Overlapping Preview Card Showcase */}
            <div className="relative z-20 w-full max-w-7xl px-8 mt-20 md:-mb-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { title: 'The Future \nof AI is Here', color: 'from-blue-600 to-indigo-900', img: 'https://i.pinimg.com/736x/7d/d2/c1/7dd2c173e396bc75f34f1ff3acd07730.jpg' },
                        { title: 'Elegance in \nEvery Scent', color: 'from-rose-500 to-amber-900', img: 'https://i.pinimg.com/736x/07/77/8e/07778e354a7c06207865239e24838637.jpg' },
                        { title: 'Your Life, \nSimplified', color: 'from-[#DFFF00] to-green-900', img: 'https://i.pinimg.com/736x/8e/4a/0f/8e4a0f4a8eb9a7f33d7b30c4f8d29837.jpg' }
                    ].map((card, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 100 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 + 0.5, duration: 0.8 }}
                            className="relative aspect-[4/5] rounded-[3rem] overflow-hidden border border-white/10 group shadow-2xl bg-[#121212]"
                        >
                            <Image
                                src={card.img}
                                alt={card.title}
                                fill
                                className="object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
                            />
                            <div className={`absolute inset-0 bg-gradient-to-t ${card.color} opacity-20 group-hover:opacity-40 transition-opacity`} />

                            <div className="absolute inset-0 p-10 flex flex-col justify-end">
                                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white leading-tight whitespace-pre-line mb-4">
                                    {card.title}
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                    <span>Case Study</span>
                                    <ChevronRight size={12} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default SocialHero;
