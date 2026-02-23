'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

const Features = () => {
    const features = [
        {
            title: "Digital Essence",
            tag: "01. AVATARS",
            description: "We don't just build characters. We capture the soul of your expression in high-fidelity 3D.",
            visual: "/avatar.png",
            color: "bg-white/5",
            align: 'left'
        },
        {
            title: "Cinematic Flow",
            tag: "02. MOVIES",
            description: "Transform static scripts into breathing, cinematic worlds with AI that understands emotion.",
            visual: "/movie-scene.png",
            color: "bg-white/5",
            align: 'right'
        },
        {
            title: "Artistic Intelligence",
            tag: "03. ENGINE",
            description: "Technology that scales with your imagination. Powerful, intuitive, and invisible.",
            visual: "/ai-engine.png",
            color: "bg-white/5",
            align: 'left'
        }
    ];

    return (
        <section id="features" data-section-theme="dark" className="bg-[#000000] overflow-hidden rounded-[80px] relative z-10 -mt-20">
            <div className="bg-[#000000] py-32 px-6 md:px-20 overflow-hidden relative w-full">
                {/* Decorative Background Glows */}
                <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-accent-orange/10 blur-[60px] rounded-full -z-0 pointer-events-none transform-gpu" />
                <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-accent-sky/5 blur-[60px] rounded-full -z-0 pointer-events-none transform-gpu" />
                <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-accent-orange/5 rounded-full blur-[60px] -z-0 pointer-events-none mix-blend-screen transform-gpu" />

                <div className="container relative z-10 flex flex-col items-center">
                    {/* Section Header */}
                    <div className="mb-40 text-center max-w-4xl">
                        <motion.span
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            className="text-xs font-bold tracking-[0.4em] text-accent-orange uppercase mb-8 block"
                        >
                            Capabilities
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            className="text-5xl md:text-[100px] font-black mb-12 leading-[0.85] tracking-tight text-white"
                        >
                            Crafting the <span className="text-cursive text-accent-orange text-[1.4em] leading-none font-normal lowercase tracking-normal inline-block translate-y-4">impossible</span> with ease.
                        </motion.h2>
                        <div className="h-[1px] w-24 bg-accent-orange/40 mx-auto" />
                    </div>

                    {/* Feature Blocks */}
                    <div className="space-y-64 w-full">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                className={`flex flex-col ${feature.align === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-16 md:gap-40 text-left`}
                            >
                                <div className="flex-1">
                                    <motion.div
                                        initial={{ opacity: 0, x: feature.align === 'right' ? 50 : -50 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true, margin: "-100px" }}
                                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                        className="transform-gpu"
                                    >
                                        <span className="text-xs font-bold tracking-[0.4em] text-accent-orange uppercase mb-8 block">
                                            {feature.tag}
                                        </span>
                                        <h3 className="text-5xl md:text-7xl font-bold mb-10 leading-tight text-white tracking-tighter">{feature.title}</h3>
                                        <p className="text-xl md:text-2xl text-zinc-400 leading-relaxed mb-16 max-w-lg font-medium">
                                            {feature.description}
                                        </p>
                                        <a href="#" className="inline-flex items-center gap-4 text-sm font-black uppercase tracking-widest text-white hover:text-accent-orange transition-all group">
                                            <span>Explore Engine</span>
                                            <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-accent-orange group-hover:text-white group-hover:border-accent-orange transition-all duration-500">
                                                <ArrowUpRight size={20} />
                                            </div>
                                        </a>
                                    </motion.div>
                                </div>

                                <div className="flex-1 w-full">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 50 }}
                                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                                        viewport={{ once: true, margin: "-100px" }}
                                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                        className={`relative aspect-[4/5] md:aspect-[5/6] rounded-[48px] md:rounded-[80px] ${feature.color} overflow-hidden group shadow-2xl border border-white/5 transform-gpu`}
                                    >
                                        <Image
                                            src={feature.visual}
                                            alt={feature.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-700" />

                                        {/* Corner Info */}
                                        <div className="absolute bottom-10 left-10 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-y-4 group-hover:translate-y-0">
                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Module // {feature.tag.split('. ')[1]}</span>
                                        </div>
                                    </motion.div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Features;
