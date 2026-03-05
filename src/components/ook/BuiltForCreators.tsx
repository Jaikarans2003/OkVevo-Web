'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
    return twMerge(clsx(inputs));
}

const creators = [
    {
        number: "1",
        tag: "CONTENT CREATOR",
        title: "Content Creator",
        description: "Create talking avatar videos in seconds. Upload your avatar, generate a script and produce Social Media ready videos instantly.",
        img: "/avatar.png",
        accent: "from-accent-orange/20 to-transparent"
    },
    {
        number: "2",
        tag: "MARKETERS",
        title: "Marketers",
        description: "Generate product ads instantly. Create stunning product photos without a studio. Upload your product and generate lifestyle images and marketing visuals instantly.",
        img: "/movie-scene.png",
        accent: "from-accent-sky/20 to-transparent"
    },
    {
        number: "3",
        tag: "STARTUPS",
        title: "Startups",
        description: "Create explainer videos. Turn complex ideas into engaging visual stories that convert viewers into customers.",
        img: "/ai-engine.png",
        accent: "from-accent-lavender/20 to-transparent"
    },
    {
        number: "4",
        tag: "AGENCIES",
        title: "Agencies",
        description: "Produce high-quality client videos at scale. Deliver professional content faster than ever with AI-powered production pipelines.",
        img: "/avatar.png",
        accent: "from-accent-orange/20 to-transparent"
    }
];

const BuiltForCreators = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
    const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isHoveredRef = useRef(false);

    // Handle Animation
    const animateCards = useCallback((index: number, immediate = false) => {
        if (!cardsRef.current.length) return;

        const total = creators.length;
        const isMobile = window.innerWidth < 768;

        cardsRef.current.forEach((card, i) => {
            if (!card) return;

            let offset = (i - index + total) % total;
            if (offset > 2) offset -= total;
            if (offset < -2) offset += total;

            let props = {
                x: 0,
                y: 0,
                scale: 1,
                opacity: 1,
                zIndex: 10,
                filter: "brightness(1)",
            };

            if (offset === 0) {
                props = { x: 0, y: 0, scale: 1, opacity: 1, zIndex: 10, filter: "brightness(1)" };
            } else if (offset === -1) {
                const xOffset = isMobile ? -50 : -600;
                props = { x: xOffset, y: 0, scale: 0.8, opacity: 0.8, zIndex: 9, filter: "brightness(0.7)" };
            } else if (offset === 1) {
                const xOffset = isMobile ? 50 : 600;
                props = { x: xOffset, y: 0, scale: 0.8, opacity: 0.8, zIndex: 9, filter: "brightness(0.7)" };
            } else if (offset === -2 || offset === 2) {
                const xOffset = offset === -2 ? (isMobile ? -100 : -1000) : (isMobile ? 100 : 1000);
                props = { x: xOffset, y: 0, scale: 0.6, opacity: 0, zIndex: 4, filter: "brightness(0.5)" };
            }

            const duration = immediate ? 0 : 0.8;
            const ease = "power2.out";

            gsap.to(card, {
                ...props,
                duration: duration,
                ease: ease,
                overwrite: "auto",
            });
        });
    }, []);

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            animateCards(activeIndex, true);
            isFirstRender.current = false;
        }
    }, [activeIndex, animateCards]);

    const nextSlide = useCallback(() => {
        if (isAnimating) return;
        setIsAnimating(true);
        setActiveIndex((prev) => {
            const newIndex = (prev + 1) % creators.length;
            animateCards(newIndex);
            return newIndex;
        });
        setTimeout(() => setIsAnimating(false), 800);
    }, [isAnimating, animateCards]);

    const prevSlide = useCallback(() => {
        if (isAnimating) return;
        setIsAnimating(true);
        setActiveIndex((prev) => {
            const newIndex = (prev - 1 + creators.length) % creators.length;
            animateCards(newIndex);
            return newIndex;
        });
        setTimeout(() => setIsAnimating(false), 800);
    }, [isAnimating, animateCards]);

    useEffect(() => {
        const startAutoScroll = () => {
            if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
            autoScrollTimerRef.current = setInterval(() => {
                if (!isHoveredRef.current) {
                    nextSlide();
                }
            }, 3000);
        };

        startAutoScroll();

        return () => {
            if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
        };
    }, [nextSlide]);

    const handleMouseEnter = () => {
        isHoveredRef.current = true;
        if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
    };

    const handleMouseLeave = () => {
        isHoveredRef.current = false;
        if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
        autoScrollTimerRef.current = setInterval(() => {
            nextSlide();
        }, 3000);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
                prevSlide();
                if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
                if (!isHoveredRef.current) {
                    autoScrollTimerRef.current = setInterval(nextSlide, 3000);
                }
            }
            if (e.key === "ArrowRight") {
                nextSlide();
                if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
                if (!isHoveredRef.current) {
                    autoScrollTimerRef.current = setInterval(nextSlide, 3000);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [nextSlide, prevSlide]);

    return (
        <section id="built-for-creators" className="relative min-h-screen flex flex-col justify-center bg-bg-main overflow-hidden py-24">
            {/* Background Orange Glow - Hero Style */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] bg-accent-orange/15 blur-[160px] rounded-full" />
            </div>

            {/* Background Decorative Gradients - Hero Style */}
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

            {/* Header */}
            <div className="container mx-auto px-4 relative z-20 mb-12 text-center md:text-left">
                <div className="flex items-center gap-4 mb-4 justify-center md:justify-start">
                    <div className="w-12 h-[1px] bg-accent-orange" />
                    <span className="text-accent-orange text-sm tracking-widest uppercase">For Everyone</span>
                </div>
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-none text-text-main font-black">
                    Built for Modern <span className="text-accent-orange italic">Creators</span>
                </h2>
            </div>

            <div
                ref={containerRef}
                className="relative w-full h-[600px] flex items-center justify-center perspective-1000"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Cards Layer */}
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {creators.map((creator, i) => (
                        <div
                            key={i}
                            ref={(el) => { cardsRef.current[i] = el; }}
                            className="absolute w-[90vw] md:w-[70vw] lg:w-[60vw] h-[500px] rounded-[32px] md:rounded-[48px] overflow-hidden shadow-premium bg-bg-main border border-text-main/5 flex flex-col md:flex-row items-stretch cursor-pointer will-change-transform"
                            onClick={(e) => {
                                if (i !== activeIndex && !isAnimating) {
                                    e.preventDefault();
                                    const diff = (i - activeIndex + creators.length) % creators.length;
                                    if (diff === 1 || diff === 2) nextSlide();
                                    else prevSlide();
                                }
                            }}
                        >
                            {/* Image Side */}
                            <div className={cn("hidden md:flex flex-1 items-center justify-center relative bg-gradient-to-br", creator.accent)}>
                                <Image
                                    src={creator.img}
                                    alt={creator.title}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            {/* Mobile Image */}
                            <div className={cn("md:hidden h-40 relative bg-gradient-to-br w-full", creator.accent)}>
                                <Image
                                    src={creator.img}
                                    alt={creator.title}
                                    fill
                                    className="object-cover"
                                />
                            </div>

                            {/* Content Side */}
                            <div className="flex-1 p-6 md:p-14 flex flex-col justify-between bg-[#00000] relative">
                                <div>
                                    <span className="text-xs font-bold tracking-[0.4em] text-accent-orange uppercase mb-4 md:mb-6 block">
                                        {creator.tag}
                                    </span>
                                    <h3 className="text-2xl md:text-4xl font-black mb-4 md:mb-6 leading-tight tracking-tight">
                                        {creator.title}
                                    </h3>
                                    <p className="text-base md:text-lg text-text-dim/80 leading-relaxed font-medium">
                                        {creator.description}
                                    </p>
                                </div>

                                <div className="flex items-center gap-4 mt-4 md:mt-0">
                                    <div className="h-[2px] w-12 bg-accent-orange" />
                                    <span className="text-[10px] font-black tracking-widest uppercase">Learn More</span>
                                </div>
                            </div>

                            {/* Overlay for non-active cards */}
                            <div className={cn(
                                "absolute inset-0 bg-black/40 transition-opacity duration-500 pointer-events-none",
                                i === activeIndex ? "opacity-0" : "opacity-100"
                            )} />
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="absolute bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-8 z-50">
                    <button
                        onClick={prevSlide}
                        className="p-4 rounded-full bg-text-main/10 hover:bg-text-main/20 backdrop-blur-md border border-text-main/10 transition-all hover:scale-110 active:scale-95 group"
                    >
                        <ArrowLeft className="text-text-main group-hover:text-accent-orange transition-colors" />
                    </button>

                    <div className="flex gap-3">
                        {creators.map((_, i) => (
                            <button
                                key={i}
                                className={cn(
                                    "h-2 rounded-full transition-all duration-500",
                                    i === activeIndex
                                        ? "w-8 bg-accent-orange"
                                        : "w-2 bg-text-main/20 hover:bg-text-main/40 cursor-pointer"
                                )}
                                onClick={() => {
                                    if (!isAnimating && i !== activeIndex) {
                                        setActiveIndex(i);
                                        animateCards(i);
                                    }
                                }}
                            />
                        ))}
                    </div>

                    <button
                        onClick={nextSlide}
                        className="p-4 rounded-full bg-text-main/10 hover:bg-text-main/20 backdrop-blur-md border border-text-main/10 transition-all hover:scale-110 active:scale-95 group"
                    >
                        <ArrowRight className="text-text-main group-hover:text-accent-orange transition-colors" />
                    </button>
                </div>
            </div>
        </section>
    );
};

export default BuiltForCreators;
