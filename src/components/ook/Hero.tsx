'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Play, Sparkles, UserCheck } from 'lucide-react';
import gsap from 'gsap';

interface HeroProps {
    onJoinClick: () => void;
}

const services = [
    {
        id: 'product-ads',
        title: 'AI Product Ads',
        description: 'Create cinematic product showcases in seconds.',
        video: '/videos/aiproduct.mp4',
        icon: <Sparkles className="w-5 h-5" />,
    },
    {
        id: 'script-video',
        title: 'Script-to-Video',
        description: 'Transform text stories into high-fidelity visuals.',
        video: '/videos/script.mp4',
        icon: <Play className="w-5 h-5" />,
    },
    {
        id: 'ai-influencers',
        title: 'AI Influencers',
        description: 'Scale your brand with digital-human ambassadors.',
        video: '/videos/influencer.mp4',
        icon: <UserCheck className="w-5 h-5" />,
    },
];

const Hero = ({ onJoinClick }: HeroProps) => {
    const [activeService, setActiveService] = useState(services[0]);
    const containerRef = useRef<HTMLElement>(null);
    const clapperBoardRef = useRef<HTMLDivElement>(null);
    const clapperStickRef = useRef<SVGPathElement>(null);

    useEffect(() => {
        if (!containerRef.current || !clapperBoardRef.current || !clapperStickRef.current) return;

        // Clapperboard Float Animation
        gsap.to(clapperBoardRef.current, {
            y: -25,
            x: 10,
            rotationZ: 8,
            rotationX: 10,
            rotationY: -15,
            duration: 5,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });

        // Clapperboard Stick "Clap" Animation
        gsap.set(clapperStickRef.current, { transformOrigin: "85px 35px" });
        
        const clapTl = gsap.timeline({ repeat: -1, repeatDelay: 2.5 }); // Delay between claps
        
        // Open smoothly with a slight overshoot
        clapTl.to(clapperStickRef.current, {
            rotation: -45,
            duration: 0.8,
            ease: "back.out(1.2)"
        })
        // Anticipation (hold slightly further open before strike)
        .to(clapperStickRef.current, {
            rotation: -52,
            duration: 0.4,
            ease: "sine.inOut"
        }, "+=0.3")
        // Snap close (Clap) very fast
        .to(clapperStickRef.current, {
            rotation: 0,
            duration: 0.1,
            ease: "power4.in"
        })
        // Subtle bounce recoil instantly after hitting
        .to(clapperStickRef.current, {
            rotation: -3,
            duration: 0.08,
            ease: "power2.out",
            yoyo: true,
            repeat: 1
        });

        return () => {
            clapTl.kill();
        };
    }, []);

    return (
        <section ref={containerRef} className="relative min-h-screen bg-black overflow-hidden perspective-1000">

            {/* Clapperboard Floating SVG */}
            <div 
                ref={clapperBoardRef} 
                className="absolute right-[-2%] md:right-[2%] top-[10%] md:top-[18%] w-24 h-24 md:w-36 md:h-36 z-20 pointer-events-none drop-shadow-[0_15px_30px_rgba(255,102,0,0.4)] transform-gpu opacity-50 md:opacity-100 origin-center"
                style={{ transformStyle: "preserve-3d" }}
            >
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    {/* Clapperboard Body (Stripes) */}
                    <path d="M10 40H90V90C90 92.7614 87.7614 95 85 95H15C12.2386 95 10 92.7614 10 90V40Z" fill="#1A1A1A"/>
                    <path d="M10 40H90V45H10V40Z" fill="#333333"/>
                    <path d="M15 55H85V60H15V55Z" fill="#FF6600"/>
                    <text x="50" y="80" fill="white" fillOpacity="0.4" fontSize="12" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" letterSpacing="2">SCENE 1</text>
                    
                    {/* Entire Clapper Stick Group */}
                    <g ref={clapperStickRef} style={{ transformOrigin: "85px 35px", willChange: "transform" }}>
                        <path d="M10 35H90V15C90 12.2386 87.7614 10 85 10H15C12.2386 10 10 12.2386 10 15V35Z" fill="#222222" />
                        <path d="M10 35L25 10H35L20 35H10Z" fill="#FF6600"/>
                        <path d="M30 35L45 10H55L40 35H30Z" fill="#FF6600"/>
                        <path d="M50 35L65 10H75L60 35H50Z" fill="#FF6600"/>
                        <path d="M70 35L85 10H90V15L90 35H70Z" fill="#FF6600"/>
                        {/* Stick Base Outline */}
                        <path d="M10 35H90L85 10H15L10 35Z" fill="white" fillOpacity="0.1" stroke="#444" strokeWidth="1" strokeLinejoin="round"/>
                    </g>
                    
                    {/* Small Hinge Circle */}
                    <circle cx="85" cy="35" r="4" fill="#555"/>
                    <circle cx="85" cy="35" r="2" fill="#222"/>
                </svg>
            </div>

            {/* Top Text Section with Soft Glow */}
            <div className="relative pt-20 pb-4 px-6 overflow-hidden text-white flex flex-col items-center justify-center min-h-[40vh]">
                {/* Subtle Orange Glow Background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] max-w-3xl h-[200px] md:h-[350px] rounded-full bg-[#FF6600]/25 blur-[60px] md:blur-[80px] z-0 pointer-events-none transform-gpu" />

                <div className="max-w-7xl mx-auto flex flex-col items-center text-center w-full relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full flex flex-col items-center relative"
                    >
                        <h1 className="text-[4.5rem] md:text-[9rem] tracking-tight mt-16 flex flex-col items-center leading-[0.9] pb-2 relative z-10 font-bold">
                            <motion.span 
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                                className="text-white relative z-20 px-8"
                            >
                                Zero Camera,
                            </motion.span>
                            <motion.span 
                                initial={{ opacity: 0, pathLength: 0 }}
                                animate={{ opacity: 1, pathLength: 1 }}
                                transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
                                className="text-cursive italic text-accent-orange text-[5.5rem] md:text-[11rem] lowercase relative z-20 font-medium whitespace-nowrap pt-0 pb-4 md:pb-8 leading-normal md:leading-normal -mt-4 md:-mt-8"
                                style={{
                                    WebkitBackgroundClip: "text",
                                    backgroundImage: "linear-gradient(90deg, transparent 0%, transparent 100%)",
                                    animation: "write-text 2s ease-out 0.5s forwards"
                                }}
                            >
                                Infinite Vision.
                            </motion.span>
                        </h1>
                        
                        <p className="-mt-10 text-lg md:text-2xl text-white/70 font-medium max-w-2xl text-center pb-8 z-10">
                            Create cinematic videos from scripts and avatars using AI.<br />
                            No camera. No studio. Just imagination.
                        </p>

                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onJoinClick}
                            className="relative z-10 group px-12 py-4 bg-white text-black hover:bg-accent-orange hover:text-white hover:border-accent-orange border-2 border-transparent rounded-full font-bold text-lg md:text-xl transition-all duration-300"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                Create
                                <ArrowUpRight className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
                            </span>
                            <div className="absolute inset-0 bg-accent-orange/20 rounded-full blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
                        </motion.button>
                    </motion.div>
                </div>
            </div>

            {/* Video Showcase Section */}
            <div data-section-theme="dark" className="relative px-4 pb-12 md:px-6 md:pb-20 bg-black">
                {/* Soft blur glow behind video */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-6xl h-[70vh] rounded-[4rem] bg-white/5 blur-[80px] -z-10 pointer-events-none" />

                <div className="relative aspect-[16/9] w-full max-h-[80vh] rounded-[2.5rem] md:rounded-[4rem] overflow-hidden group border border-white/5 bg-black shadow-2xl transition-transform duration-500 hover:scale-[1.02] transform-gpu">
                    {/* Performance friendly fade mask equivalent */}
                    <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black to-transparent z-20 pointer-events-none" />
                    
                    {/* Background Video Transitions */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeService.id}
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0 w-full h-full"
                        >
                            <video
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover"
                                src={activeService.video}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        </motion.div>
                    </AnimatePresence>

                    {/* Content Overlay */}
                    <div className="absolute inset-0 flex flex-col justify-between p-8 md:p-16 lg:p-20">
                        {/* Empty spacing for branding/top elements if needed */}
                        <div />

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
                            {/* Left: Headline & Primary Action */}
                            <div className="lg:col-span-12 space-y-6">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeService.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.5 }}
                                        className="max-w-4xl"
                                    >
                                        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.95] tracking-tight mb-4">
                                            {activeService.title}
                                        </h2>
                                        <p className="text-lg md:text-xl text-white/60 font-medium max-w-xl">
                                            {activeService.description}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>

                                <div className="flex flex-wrap items-center gap-4">
                                    <button
                                        onClick={onJoinClick}
                                        className="group bg-white text-black hover:bg-accent-orange hover:text-white border-2 border-transparent hover:border-accent-orange px-10 py-5 rounded-full font-bold flex items-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        Try Now
                                        <ArrowUpRight className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vertical Service Navigation (Right Side) */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-3 z-30">
                        {services.map((service) => (
                            <button
                                key={service.id}
                                onMouseEnter={() => setActiveService(service)}
                                className={`group flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 border
                                    ${activeService.id === service.id
                                        ? 'bg-white/10 backdrop-blur-xl border-white/20 shadow-xl'
                                        : 'bg-black/20 backdrop-blur-sm border-transparent hover:bg-white/5'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                                    ${activeService.id === service.id ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                                    {service.icon}
                                </div>
                                <div className="text-left">
                                    <p className={`text-sm font-bold transition-colors ${activeService.id === service.id ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
                                        {service.title}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile Service Selector */}
                <div className="lg:hidden mt-6 bg-black p-4 rounded-3xl grid grid-cols-3 gap-2">
                    {services.map((service) => (
                        <button
                            key={service.id}
                            onClick={() => setActiveService(service)}
                            className={`p-3 rounded-2xl text-[10px] font-bold transition-all border
                                ${activeService.id === service.id
                                    ? 'bg-white/10 border-white/20 text-white'
                                    : 'bg-white/5 border-transparent text-white/40'}`}
                        >
                            {service.title.split(' ')[0]}
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Hero;
