'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import DigitalWallet from '@/components/DigitalWallet';

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
            };

            if (offset === 0) {
                props = { x: 0, y: 0, scale: 1, opacity: 1, zIndex: 10 };
            } else if (offset === -1) {
                const xOffset = isMobile ? -50 : -600;
                props = { x: xOffset, y: 0, scale: 0.8, opacity: 0.8, zIndex: 9 };
            } else if (offset === 1) {
                const xOffset = isMobile ? 50 : 600;
                props = { x: xOffset, y: 0, scale: 0.8, opacity: 0.8, zIndex: 9 };
            } else if (offset === -2 || offset === 2) {
                const xOffset = offset === -2 ? (isMobile ? -100 : -1000) : (isMobile ? 100 : 1000);
                props = { x: xOffset, y: 0, scale: 0.6, opacity: 0, zIndex: 4 };
            }

            const duration = immediate ? 0 : 0.8;
            const ease = "power2.out";

            gsap.to(card, {
                ...props,
                duration: duration,
                ease: ease,
                overwrite: "auto",
                force3D: true,
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
        <section id="built-for-creators" className="relative h-[700px] md:h-[700px] flex flex-col justify-end bg-black overflow-hidden pt-12 pb-20">
            {/* Header */}
            <div className="absolute top-12 left-4 md:left-8 z-30">
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none text-white">
                    Who is it <span className="text-accent-orange italic">For?</span>
                </h2>
            </div>

            {/* Digital Wallet Interactive Background */}
            <div className="absolute inset-0 z-20">
                <DigitalWallet balance="Built for Creators" cards={creators} />
            </div>
            <div
                ref={containerRef}
                className="relative w-full h-[600px] flex items-center justify-center perspective-1000 hidden"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Cards Layer - Hidden, now displayed in wallet */}
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {creators.map((creator, i) => (
                        <div
                            key={i}
                            ref={(el) => { cardsRef.current[i] = el; }}
                            className="absolute w-[85vw] md:w-[60vw] lg:w-[50vw] h-[400px] md:h-[450px] rounded-[32px] md:rounded-[48px] overflow-hidden shadow-premium bg-bg-main border border-text-main/5 flex flex-col md:flex-row items-stretch cursor-pointer will-change-transform"
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
