'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, Play, Sparkles, Zap, Eye, Target, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

import NoiseOverlay from '../../components/NoiseOverlay';
import Navbar from '../../components/ook/Navbar';
import Footer from '../../components/ook/Footer';

export default function AboutPage() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

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

    const stats = [
        { label: "AI Models Trained", val: "500+" },
        { label: "Frames Generated", val: "10M+" },
        { label: "Studio Partners", val: "25+" },
        { label: "Creator Hours Saved", val: "100k+" }
    ];

    const philosophies = [
        { id: "001", title: "ZERO GRAVITY VELOCITY" },
        { id: "002", title: "VISION-FIRST DESIGN" },
        { id: "003", title: "INFINITE PRECISION" },
        { id: "004", title: "NEURAL CINEMATOGRAPHY" }
    ];

    return (
        <div className="min-h-screen bg-[#050505] overflow-x-hidden text-white selection:bg-orange-500/30">
            <NoiseOverlay />
            <Navbar user={user} onJoinClick={handleJoinClick} />

            {/* Section 1: Hero Section - CREATIVE [LOGO] DIGITAL */}
            <section className="pt-40 pb-20 px-6">
                <div className="max-w-[1400px] mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col items-center"
                    >
                        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 mb-4">
                            <h1 className="text-7xl md:text-[140px] font-black tracking-[-0.05em] leading-none uppercase">
                                Creative
                            </h1>
                            <div className="w-20 h-20 md:w-32 md:h-32 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20 backdrop-blur-3xl p-6 relative group overflow-hidden">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent opacity-50"
                                />
                                <Image
                                    src="/OKVEVO WithOut BackGrounds/Orange.svg"
                                    alt="OKVEVO"
                                    width={80}
                                    height={80}
                                    className="relative z-10 w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                                    priority
                                />
                            </div>
                            <h1 className="text-7xl md:text-[140px] font-black tracking-[-0.05em] leading-none uppercase">
                                Digital
                            </h1>
                        </div>
                        <h2 className="text-4xl md:text-[80px] font-black tracking-[-0.03em] leading-none uppercase text-white/20">
                            Cinematic Studio
                        </h2>
                        
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 1 }}
                            className="mt-12 text-sm md:text-base tracking-[0.4em] uppercase font-bold text-white/40"
                        >
                            Bridging the gap between imagination and execution
                        </motion.p>
                    </motion.div>
                </div>
            </section>

            {/* Section 2: Our Story & Stats Section */}
            <section className="py-2 px-6">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col lg:flex-row items-start gap-20">
                        {/* Story Text */}
                        <div className="w-full lg:w-1/3">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-px w-12 bg-orange-500" />
                                <span className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Our story</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-bold leading-tight tracking-tight text-white mb-10">
                                OKVEVO wasn't born in a lab; it was born on the creator's desk. We realized that the biggest bottleneck to creation wasn't talent — it was time.
                            </p>
                            <button className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center group hover:bg-white hover:text-black transition-all duration-500">
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        {/* Story Image */}
                        <div className="flex-1 w-full relative group">
                            <div className="aspect-[16/10] rounded-[50px] overflow-hidden bg-neutral-900 border border-white/10 relative">
                                <Image
                                    src="/ai-engine.png" // Placeholder, using ai-engine.png from project
                                    alt="OKVEVO Engine"
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-1000 brightness-75"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                
                                <div className="absolute bottom-10 left-10">
                                    <button className="bg-orange-600 text-white px-8 py-4 rounded-full flex items-center gap-4 font-black uppercase tracking-widest text-[10px] group transition-all hover:bg-orange-500">
                                        <span>Know More</span>
                                        <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="w-full lg:w-auto flex flex-col gap-12 pt-10">
                            {stats.map((stat, i) => (
                                <div key={i} className="flex flex-col items-start border-l border-white/10 pl-8">
                                    <span className="text-4xl md:text-5xl font-black text-white">{stat.val}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-2">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 3: Intermediate Action Section (Video Thumbnail Style) */}
            <section className="py-10 px-4 md:px-10">
                <div className="w-full rounded-[60px] bg-[#0A0A0A] border border-white/5 overflow-hidden relative group">
                    <div className="px-10 py-20 flex flex-col md:flex-row items-end justify-between border-b border-white/5">
                        <h2 className="text-4xl md:text-6xl font-black tracking-[-0.05em] leading-tight max-w-2xl">
                            Designing For <span className="text-orange-500">Tomorrow's</span> Success Today
                        </h2>
                        <div className="mt-8 md:mt-0 text-white/40 text-sm max-w-sm font-medium leading-relaxed uppercase tracking-widest">
                            Design that speaks volumes creating brands that stand out Design with purpose
                        </div>
                    </div>

                    <div className="relative aspect-video w-full">
                        <Image
                            src="/movie-scene.png"
                            alt="Cinematic Preview"
                            fill
                            className="object-cover brightness-50 group-hover:scale-[1.02] transition-transform duration-1000"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <motion.button 
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                className="w-24 h-24 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:bg-orange-500 transition-colors"
                            >
                                <Play fill="currentColor" size={32} />
                            </motion.button>
                        </div>
                        
                        {/* Floating "Explore" badge */}
                        <div className="absolute top-10 right-10">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="w-32 h-32 rounded-full border border-white/10 flex items-center justify-center backdrop-blur-md relative"
                            >
                                <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black uppercase tracking-[0.4em] text-white/60">
                                    <svg className="w-full h-full p-2" viewBox="0 0 100 100">
                                        <defs>
                                            <path id="circlePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" />
                                        </defs>
                                        <text fill="white" className="uppercase font-black text-[12px] tracking-[2px]">
                                            <textPath xlinkHref="#circlePath">
                                                • Explore More • Imagine • Create • Render
                                            </textPath>
                                        </text>
                                    </svg>
                                </div>
                                <ArrowUpRight className="text-orange-500" size={24} />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 4: Services/Philosophy List Section */}
            <section className="py-32 px-6">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col md:flex-row items-center gap-6 mb-20">
                        <div className="bg-white/5 border border-white/10 rounded-full px-6 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
                            Philosophy
                        </div>
                        <div className="text-base md:text-xl font-medium text-white/80">
                            Innovative Cinematic Solutions
                        </div>
                    </div>

                    <div className="flex flex-col">
                        {philosophies.map((p, i) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="group py-12 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 cursor-pointer relative overflow-hidden"
                            >
                                {/* Hover background effect */}
                                <div className="absolute inset-0 bg-white/[0.01] translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                
                                <div className="flex items-center gap-8 md:gap-16 relative z-10">
                                    <span className="text-xs font-black text-white/20 border border-white/10 rounded-full px-4 py-1">
                                        {p.id}
                                    </span>
                                    <h3 
                                        className="text-4xl md:text-[80px] font-black  tracking-[-0.03em] uppercase transition-all duration-500 group-hover:text-orange-500 group-hover:pl-4"
                                    >
                                        {p.title}
                                    </h3>
                                </div>

                                <div className="flex items-center gap-10 md:gap-20 relative z-10 w-full md:w-auto">
                                    
                                    <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-orange-500 group-hover:border-transparent group-hover:text-black transition-all duration-500">
                                        <ArrowUpRight size={24} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="max-w-[1400px] mx-auto rounded-[60px] bg-gradient-to-br from-orange-600 to-orange-900 p-20 text-center flex flex-col items-center"
                >
                    <h2 className="text-5xl md:text-8xl font-black tracking-[-0.05em] uppercase leading-none mb-10">
                        Ready to <br/> <span className="text-black/30">Direct?</span>
                    </h2>
                    <button 
                        onClick={handleJoinClick}
                        className="bg-white text-black px-16 py-6 rounded-full font-black uppercase tracking-[0.3em] text-xs hover:bg-black hover:text-white transition-all duration-500 shadow-2xl"
                    >
                        Enter Workspace
                    </button>
                </motion.div>
            </section>

            <Footer />
        </div>
    );
}
