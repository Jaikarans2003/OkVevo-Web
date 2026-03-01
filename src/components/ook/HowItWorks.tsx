'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';

function cn(...inputs: any[]) {
    return twMerge(clsx(inputs));
}

const HowItWorks = () => {
    const sectionRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: sectionRef,
    });

    // Horizontal scroll for the container - extended to show all 3 cards
    const x = useTransform(scrollYProgress, [0, 1], ["0%", "-100%"]);

    const steps = [
        {
            number: "01",
            tag: "IDENTITY",
            title: "Digital Essence",
            description: "Upload your portrait. Our neural engine decodes your facial geometry to create a high-fidelity 3D match.",
            img: "/avatar.png",
            accent: "from-accent-orange/20 to-transparent"
        },
        {
            number: "02",
            tag: "DIRECTION",
            title: "The Script",
            description: "Direct your character with plain language. Watch as scenes are built, lit, and blocked automatically by our AI.",
            img: "/movie-scene.png",
            accent: "from-accent-sky/20 to-transparent"
        },
        {
            number: "03",
            tag: "PRODUCTION",
            title: "Cinematic Output",
            description: "Render high-fidelity experiences at the touch of a button. Professional storytelling, scaled for everyone.",
            img: "/ai-engine.png",
            accent: "from-accent-lavender/20 to-transparent"
        }
    ];

    return (
        <section id="how-it-works" data-section-theme="light" ref={sectionRef} className="relative h-[500vh] bg-bg-main">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/OKVEVO With BackGrounds/liana-s-iU7wmIfqHwI-unsplash.jpg"
                    alt="How It Works Background"
                    fill
                    className="object-cover"
                    priority
                />
                {/* Dark overlay for content readability */}
                <div className="absolute inset-0 bg-black/50" />
            </div>
            
            <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
                {/* Ambient Background Glows */}
                <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-accent-orange/5 blur-[40px] rounded-full pointer-events-none transform-gpu" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-accent-sky/5 blur-[40px] rounded-full pointer-events-none transform-gpu" />

                {/* Header - Fixed in sticky container with more padding-top to avoid navbar */}
                <div className="centering-container !items-start pt-20 mb-8 px-[10vw] relative z-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4 mb-4"
                    >
                        <div className="w-12 h-[1px] bg-accent-orange" />
                        <span className="text-[10px] font-bold tracking-[0.5em] text-accent-orange uppercase">
                            The Process
                        </span>
                    </motion.div>
                    <h2 className="text-6xl md:text-9xl font-black tracking-[-0.04em] leading-none uppercase text-text-main">
                        Evolution <br />
                        <span className="text-accent-orange italic font-normal lowercase tracking-normal">of story.</span>
                    </h2>
                </div>

                {/* Horizontal Scroll Track - Adjusted spacing */}
                <div className="relative mt-8">
                    <motion.div
                        style={{ x, willChange: "transform" }}
                        className="flex gap-16 px-[10vw] transform-gpu"
                    >
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="min-w-[85vw] md:min-w-[70vw] lg:min-w-[60vw] h-[50vh] rounded-[48px] overflow-hidden relative group shadow-premium bg-bg-main border border-text-main/5 flex flex-col md:flex-row items-stretch"
                                style={{ willChange: 'transform' }}
                            >
                                {/* Visual Side */}
                                <div className={cn("hidden md:flex flex-1 items-center justify-center relative p-12 bg-gradient-to-br", step.accent)}>
                                    <Image
                                        src={step.img}
                                        alt={step.title}
                                        fill
                                        className="object-contain group-hover:scale-105 transition-transform duration-700 !relative !w-full !h-full"
                                    />
                                    {/* Number Overlay */}
                                    <span className="absolute top-8 left-8 text-[120px] font-black text-text-main/5 pointer-events-none select-none">
                                        {step.number}
                                    </span>
                                </div>

                                {/* Content Side */}
                                <div className="flex-1 p-10 md:p-14 flex flex-col justify-between bg-white/[0.03] dark:bg-white/[0.03] relative border-l border-white/5">
                                    <div>
                                        <span className="text-xs font-bold tracking-[0.4em] text-accent-orange uppercase mb-6 block">
                                            Step {step.number} — {step.tag}
                                        </span>
                                        <h3 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tight">
                                            {step.title}
                                        </h3>
                                        <p className="text-lg md:text-xl text-text-dim/80 leading-relaxed font-medium">
                                            {step.description}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="h-[2px] w-12 bg-accent-orange" />
                                        <span className="text-[10px] font-black tracking-widest uppercase text-white">Start Journey</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Dynamic Progress indicator - Adjusted positioning */}
                <div className="centering-container mt-16 px-[10vw]">
                    <div className="w-full lg:w-3/4 h-[2px] bg-text-main/10 relative overflow-hidden rounded-full">
                        <motion.div
                            style={{ scaleX: scrollYProgress }}
                            className="absolute inset-0 bg-accent-orange origin-left"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
