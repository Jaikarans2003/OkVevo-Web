'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, useSpring } from 'framer-motion';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Play, Sparkles, Zap, Eye, Target, ArrowUpRight, Clapperboard, MonitorPlay } from 'lucide-react';
import Image from 'next/image';

import NoiseOverlay from '@/components/shared/NoiseOverlay';
import Navbar from '@/components/landing-page/Navbar';
import Footer from '@/components/landing-page/Footer';
import Breadcrumb from '@/components/shared/Breadcrumb';
import JsonLd from '@/components/shared/JsonLd';

const Counter = ({ value, label }: { value: string, label: string }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });
    const [displayValue, setDisplayValue] = useState("0");
    
    useEffect(() => {
        if (isInView) {
            const numericValue = parseInt(value);
            if (isNaN(numericValue)) {
                setDisplayValue(value);
                return;
            }
            
            let start = 0;
            const duration = 2000;
            const startTime = performance.now();
            
            const update = (now: number) => {
                const progress = Math.min((now - startTime) / duration, 1);
                const current = Math.floor(progress * numericValue);
                setDisplayValue(`${current}${value.includes('+') ? '+' : value.includes('M') ? 'M+' : ''}`);
                
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    setDisplayValue(value);
                }
            };
            requestAnimationFrame(update);
        }
    }, [isInView, value]);

    return (
        <div ref={ref} className="flex flex-col items-start border-l border-white/10 pl-8 group">
            <span className="text-4xl md:text-5xl font-black text-white group-hover:text-orange-500 transition-colors duration-500">
                {displayValue}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-2 group-hover:text-white/60 transition-colors">
                {label}
            </span>
        </div>
    );
};

const AnimatedText = ({ text, className }: { text: string, className: string }) => {
    const letters = text.split("");
    const container = {
        hidden: { opacity: 0 },
        visible: (i = 1) => ({
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.04 * i },
        }),
    };

    const child = {
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring" as const,
                damping: 12,
                stiffness: 200,
            },
        },
        hidden: {
            opacity: 0,
            y: 20,
            transition: {
                type: "spring" as const,
                damping: 12,
                stiffness: 200,
            },
        },
    };

    return (
        <motion.div
            style={{ display: "flex", overflow: "hidden" }}
            variants={container}
            initial="hidden"
            animate="visible"
            className={className}
        >
            {letters.map((letter, index) => (
                <motion.span variants={child} key={index}>
                    {letter === " " ? "\u00A0" : letter}
                </motion.span>
            ))}
        </motion.div>
    );
};

export default function AboutPage() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });
    
    const yHero = useTransform(scrollYProgress, [0, 0.2], [0, -100]);
    const opacityHero = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);


    const handleJoinClick = () => {
        if (user) {
            router.push('/workspace');
        } else {
            router.push('/login');
        }
    };

    // const stats = [
    //     { label: "Videos Generated", val: "10k+" },
    //     { label: "Active Creators", val: "500+" },
    //     { label: "AI Avatars Created", val: "1k+" },
    //     { label: "Hours Saved Daily", val: "2k+" }
    // ];

    const philosophies = [
  {
    id: "01",
    title: "INSTANT AI VIDEO CREATION",
    desc: "Turn source media into polished videos with AI-assisted editing, captions, and custom visuals.",
    href: "/nia"
  },
  {
    id: "02",
    title: "CUSTOM HYPERFRAMES",
    desc: "Build deterministic animated compositions that combine narration, media, captions, and brand visuals.",
    href: "/nia"
  },
  {
    id: "03",
    title: "FULL CREATIVE CONTROL",
    desc: "Customize every video with branding, logos, captions, and overlays. Maintain consistency across all your social media and marketing content.",
    href: "/nia"
  },
  {
    id: "04",
    title: "INSTANT TREND VIRALITY",
    desc: "Your AI Adda is built for viral content creation. Pick trending formats, create instantly, and generate scroll-stopping reels designed for maximum reach and engagement.",
    href: "/Showcase"
  }
];

    return (
        <div ref={containerRef} className="min-h-screen bg-[#020202] overflow-x-hidden text-white selection:bg-orange-500/30">
            <JsonLd data={{
                "@context": "https://schema.org",
                "@type": "AboutPage",
                "name": "About OKVEVO",
                "description": "OkVevo is an AI video creation platform for editing source media, generating custom visuals, adding captions, and producing polished videos."
            }} />
            <NoiseOverlay />
            <Navbar />
            <main className="pt-36">
                <div className="max-w-[1400px] mx-auto px-6 mb-4 relative z-50">
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-xs font-black uppercase tracking-[0.3em] text-white/60 hover:bg-orange-500 hover:border-orange-500 hover:text-white transition-all duration-300 group backdrop-blur-sm cursor-pointer"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </button>
                </div>

            <section className="relative pt-8 pb-32 px-6 overflow-hidden">
                <motion.div 
                    style={{ y: yHero, opacity: opacityHero }}
                    className="max-w-[1400px] mx-auto text-center z-10 relative"
                >
                    <div className="flex flex-col items-center">
                        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 mb-4">
                            <AnimatedText 
                                text="REDEFINING" 
                                className="text-7xl md:text-[160px] font-black tracking-[-0.05em] leading-none uppercase mix-blend-difference" 
                            />
                            
                            <motion.div 
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ duration: 1, type: "spring" }}
                                className="w-24 h-24 md:w-40 md:h-40 bg-orange-500 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(255,102,0,0.3)] border-4 border-white/10 relative group overflow-hidden"
                            >
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"
                                />
                                <Image
                                    src="/OKVEVO Logos WithOut BackGrounds/Orange.svg"
                                    alt="OKVEVO"
                                    width={100}
                                    height={100}
                                    className="relative z-10 w-full h-full object-contain p-6 invert brightness-0"
                                    priority
                                />
                            </motion.div>
                            
                            <AnimatedText 
                                text="CONTENT" 
                                className="text-7xl md:text-[160px] font-black tracking-[-0.05em] leading-none uppercase mix-blend-difference" 
                            />
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            className="relative"
                        >
                            <h1 className="text-5xl md:text-[120px] font-black tracking-[-0.04em] leading-none uppercase text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.2)]">
                                Creation
                            </h1>
                            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-orange-600 px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase">
                                Est. 2026
                            </div>
                        </motion.div>
                        
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.2 }}
                            className="mt-16 flex flex-col items-center gap-6"
                        >
                            <div className="w-px h-24 bg-gradient-to-b from-orange-500 to-transparent" />
                           <p className="text-xs md:text-sm tracking-[0.5em] uppercase font-black text-white/50 max-w-xl text-center leading-loose">
                            AI VIDEO CREATION. CONTENT THAT DRIVES GROWTH. INSTANT SCALE.
                            </p>
                        </motion.div>
                    </div>
                </motion.div>

                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[180px] -z-10" />
                <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-[200px] -z-10" />
            </section>

            <section className="py-48 px-6 relative">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col lg:flex-row items-stretch gap-24">
                        <div className="w-full lg:w-[40%] flex flex-col justify-center">
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 1 }}
                            >
                                <div className="flex items-center gap-4 mb-12">
                                    <Clapperboard className="text-orange-500" size={20} />
                                    <span className="text-xs font-black uppercase tracking-[0.4em] text-orange-500">About OkVevo</span>
                                </div>
                                <h3 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tight text-white mb-10">
                                    CONTENT <br />
                                    <span className="text-white/20">EVOLUTION</span> <br />
                                    STARTS HERE.
                                </h3>
                                <p className="text-lg md:text-xl font-medium leading-relaxed text-white/40 mb-12 border-l border-white/5 pl-8 text-left">
                                    OkVevo is an AI video creation platform built for creators, brands, and enterprises to turn source media into polished content with intelligent editing, captions, and custom visuals.
                                    <br/><br/>
                                    Beyond digital creation, OkVevo introduces "Your AI Adda"—a real-world AI content experience where users can step in, pick trending formats, and instantly generate viral-ready videos and images, making content creation fun, accessible, and built for shareability.
                                </p>
                                <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleJoinClick}
                                    className="px-10 py-5 rounded-full bg-white text-black font-black uppercase text-[10px] tracking-[4px] hover:bg-orange-500 hover:text-white transition-all flex items-center gap-4 w-fit shadow-2xl"
                                >
                                    Start Creating
                                    <ArrowRight size={16} strokeWidth={3} />
                                </motion.button>
                            </motion.div>
                        </div>

                        <div className="flex-1 relative">
                            <div className="relative aspect-[4/5] md:aspect-auto md:h-[800px]">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute inset-0 rounded-[60px] overflow-hidden border border-white/10 group"
                                >
                                    <Image
                                        src="/okvevoimg/ok7.jpeg"
                                        alt="Your AI Adda Experience"
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-[2000ms]"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                    <div className="absolute inset-0 border border-white/5 rounded-[60px] pointer-events-none group-hover:border-orange-500/40 transition-colors duration-1000" />
                                    <div className="absolute bottom-16 left-16 right-16">
                                        <h4 className="text-3xl font-black uppercase tracking-tighter mb-4">Your AI Adda</h4>
                                        <p className="text-white/60 text-sm max-w-sm leading-relaxed">
                                            Experience AI content creation in the real world. Step into our physical booth, pick trending formats, and instantly generate viral-ready videos and images designed for maximum shareability.
                                        </p>
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* <div className="w-full lg:w-auto flex flex-col justify-center gap-16">
                            {stats.map((stat, i) => (
                                <Counter key={i} value={stat.val} label={stat.label} />
                            ))}
                        </div> */}
                    </div>
                </div>
            </section>

            <section className="py-20 px-4 md:px-10">
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="w-full rounded-[80px] bg-[#080808] border border-white/5 overflow-hidden relative group shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]"
                >
                    <div className="px-12 md:px-20 py-24 flex flex-col md:flex-row items-end justify-between border-b border-white/5 relative z-10">
                        <div className="space-y-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-orange-500">Live Preview</span>
                            <h2 className="text-5xl md:text-8xl font-black tracking-[-0.06em] leading-[0.8] uppercase">
                                YOUR AI, <br />
                                YOUR <span className="text-transparent [-webkit-text-stroke:1px_#FF6600]">IDENTITY</span> <br />
                                YOUR CONTENT
                            </h2>
                        </div>
                        <div className="mt-12 md:mt-0 max-w-md">
                            <div className="flex gap-2 mb-6">
                                {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-3 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                            </div>
                            <p className="text-white/30 text-xs font-black uppercase tracking-[0.3em] leading-relaxed">
                                Build your AI influencer <br /> with your face, voice, <br /> and content style
                            </p>
                        </div>
                    </div>

                    <div className="relative w-full max-w-3xl mx-auto overflow-hidden rounded-2xl aspect-video">
                        <iframe
                            src="https://www.youtube.com/embed/jwO-JdGpQQ4?autoplay=0&controls=1&rel=0&modestbranding=1"
                            title="OkVevo AI Content Creation"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 w-full h-full rounded-2xl"
                        />
                        
                        <div className="absolute bottom-12 right-12">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                className="w-40 h-40 rounded-full border-2 border-white/5 flex items-center justify-center backdrop-blur-sm"
                            >
                                <svg className="w-full h-full p-2" viewBox="0 0 100 100">
                                    <defs>
                                        <path id="circlePathAbout" d="M 50, 50 m -40, 0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0" />
                                    </defs>
                                    <text fill="white" className="uppercase font-black text-[10px] tracking-[3px] opacity-40">
                                        <textPath xlinkHref="#circlePathAbout">
                                            • EXPLORE THE FRONTIER • IMAGINE THE IMPOSSIBLE • RENDER THE FUTURE
                                        </textPath>
                                    </text>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Clapperboard className="text-orange-500" size={32} />
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </section>

            <section className="py-48 px-6 overflow-hidden">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col md:flex-row items-end justify-between mb-32 gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <MonitorPlay className="text-orange-500" size={16} />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">What Makes Us Different</span>
                            </div>
                            <h2 className="text-4xl md:text-7xl font-black tracking-[-0.05em] uppercase leading-[0.9]">
                                THE <span className="text-white/20">OKVEVO</span> <br />
                                ADVANTAGE.
                            </h2>
                        </div>
                        <p className="max-w-xs text-sm text-white/30 font-medium uppercase tracking-[0.2em] leading-relaxed text-right">
                            From AI influencers to viral reels, OkVevo helps you create, scale, and dominate content with speed and precision
                        </p>
                    </div>

                    <div className="flex flex-col">
                        {philosophies.map((p, i) => (
                            <Link href={p.href} key={p.id} className="block">
                            <motion.div
                                initial={{ opacity: 0, x: i % 2 === 0 ? -100 : 100 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                className="group py-20 border-b border-white/5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-12 cursor-pointer relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                
                                <div className="flex items-center gap-12 md:gap-24 relative z-10 w-full lg:w-auto">
                                    <span className="text-4xl md:text-6xl font-black text-white/5 transition-all duration-700 group-hover:text-orange-500/40">
                                        {p.id}
                                    </span>
                                    <h3 
                                        className="text-3xl md:text-6xl lg:text-7xl font-black tracking-[-0.04em] uppercase transition-all duration-700 group-hover:translate-x-8 group-hover:text-orange-500 leading-tight"
                                    >
                                        {p.title}
                                    </h3>
                                </div>

                                <div className="flex items-center gap-12 relative z-10 w-full lg:w-auto md:justify-end">
                                    <p className="max-w-[400px] text-lg text-white/20 font-medium leading-relaxed group-hover:text-white/60 transition-colors duration-500 text-left lg:text-right">
                                        {p.desc}
                                    </p>
                                    <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-orange-500 group-hover:border-transparent group-hover:text-black transition-all duration-500 group-hover:rotate-45">
                                        <ArrowUpRight size={32} />
                                    </div>
                                </div>
                            </motion.div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-32 px-6">
                <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="max-w-[1400px] mx-auto rounded-[80px] bg-[#0A0A0A] border border-white/5 p-20 md:p-40 text-center relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,102,0,0.1),transparent_70%)]" />
                    
                    <motion.div
                        animate={{ 
                            scale: [1, 1.05, 1],
                            opacity: [0.3, 0.5, 0.3]
                        }}
                        transition={{ duration: 8, repeat: Infinity }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 rounded-full blur-[150px] -z-10"
                    />

                    <div className="relative z-10">
                        <h2 className="text-6xl md:text-[120px] font-black tracking-[-0.06em] uppercase leading-[0.8] mb-12">
                            Create Viral <br/> <span className="text-transparent [-webkit-text-stroke:1px_rgba(255,102,0,0.5)] group-hover:[-webkit-text-stroke:1px_#FF6600] transition-all duration-700">Content with AI</span>
                        </h2>
                        <motion.button 
                            whileHover={{ scale: 1.1, backgroundColor: '#FF6600', color: '#fff', boxShadow: '0 0 50px rgba(255,102,0,0.5)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleJoinClick}
                            className="bg-white text-black px-20 py-8 rounded-full font-black uppercase tracking-[0.4em] text-xs transition-all duration-700"
                        >
                            Start Creating with AI
                        </motion.button>
                    </div>
                </motion.div>
            </section>

            </main>
            <Footer />
        </div>
    );
}