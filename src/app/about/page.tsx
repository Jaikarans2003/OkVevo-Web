'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Sparkles, Zap, Users, Shield, Target, Eye, ArrowRight, Play } from 'lucide-react';

import NoiseOverlay from '../../components/NoiseOverlay';
import Navbar from '../../components/ook/Navbar';
import Footer from '../../components/ook/Footer';

export default function AboutPage() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();
    const targetRef = useRef<HTMLDivElement>(null);
    
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start start", "end end"]
    });

    const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);
    const y = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

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

    return (
        <div className="min-h-screen bg-black overflow-x-hidden text-white" ref={targetRef}>
            <NoiseOverlay />
            <Navbar user={user} onJoinClick={handleJoinClick} />
            
            {/* ─── Hero Section (Parallax) ─── */}
            <section className="relative h-screen flex items-center justify-center pt-24 overflow-hidden">
                <motion.div 
                    style={{ opacity, scale, y }}
                    className="container mx-auto px-6 text-center z-10"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] uppercase font-black tracking-[3px] mb-8">
                            Our Mission
                        </span>
                        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-8 leading-[0.9]">
                            CINEMA <span className="text-orange-500">REIMAGINED.</span>
                        </h1>
                        <p className="text-lg md:text-2xl text-white/40 max-w-2xl mx-auto font-medium leading-relaxed">
                            We are bridging the gap between imagination and execution using production-grade generative AI.
                        </p>
                    </motion.div>
                </motion.div>

                {/* Abstract Background Elements */}
                <div className="absolute inset-0 z-0">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.1, 0.2, 0.1]
                        }}
                        transition={{ duration: 10, repeat: Infinity }}
                        className="absolute top-1/4 -left-20 w-96 h-96 bg-orange-600/20 rounded-full blur-[120px]"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1.2, 1, 1.2],
                            opacity: [0.1, 0.3, 0.1]
                        }}
                        transition={{ duration: 15, repeat: Infinity, delay: 2 }}
                        className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-white/5 rounded-full blur-[150px]"
                    />
                </div>

                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
                >
                    <span className="text-[10px] uppercase font-black tracking-[4px] text-white/20">Scroll to explore</span>
                    <motion.div 
                        animate={{ y: [0, 5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-[1px] h-12 bg-gradient-to-b from-orange-500 to-transparent"
                    />
                </motion.div>
            </section>

            {/* ─── Philosophy Grid ─── */}
            <section className="py-32 relative bg-neutral-950">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Zap,
                                title: "Zero Gravity Velocity",
                                desc: "Render cinematics at the speed of thought. No rendering farms, no wait times, just pure creation."
                            },
                            {
                                icon: Eye,
                                title: "Vision-First Design",
                                desc: "We build tools that augment human creativity, not replace it. Your director's eye, amplified by AI."
                            },
                            {
                                icon: Target,
                                title: "Infinite Precision",
                                desc: "Control every frame, every gesture, and every word. Production-ready quality for the modern era."
                            }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.15 }}
                                whileHover={{ y: -10 }}
                                className="group p-8 md:p-12 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-orange-500/30 transition-all duration-500 backdrop-blur-xl relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:bg-orange-500 group-hover:text-black transition-all">
                                    <item.icon size={28} />
                                </div>
                                <h3 className="text-2xl font-black tracking-tight mb-4">{item.title}</h3>
                                <p className="text-white/40 leading-relaxed font-medium">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Interactive Story Section ─── */}
            <section className="py-32 relative overflow-hidden">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16 md:gap-24">
                        <div className="flex-1 space-y-8">
                            <motion.div
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                            >
                                <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none mb-6">
                                    BUILT FOR THE <br/> <span className="text-white/20 uppercase tracking-widest text-3xl">Next Generation</span>
                                </h2>
                                <div className="h-1 w-20 bg-orange-500 mb-8" />
                                <p className="text-xl text-white/50 leading-relaxed font-medium mb-10">
                                    OKVEVO wasn't born in a lab; it was born on the creator's desk. We realized that the biggest bottleneck to creation wasn't talent—it was time. 
                                    <br/><br/>
                                    By merging high-fidelity cinematography with advanced diffusion models and lip-sync technology, we've created a playground where "impossible" is just a prompt away.
                                </p>
                                <button 
                                    onClick={handleJoinClick}
                                    className="px-10 py-5 rounded-full bg-white text-black font-black uppercase text-[12px] tracking-[4px] hover:bg-orange-500 transition-all flex items-center gap-4 group"
                                >
                                    Join the evolution
                                    <ArrowRight className="group-hover:translate-x-2 transition-transform" size={18} strokeWidth={3} />
                                </button>
                            </motion.div>
                        </div>
                        
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="flex-1 relative aspect-square w-full max-w-[500px]"
                        >
                            <div className="absolute inset-0 rounded-[4rem] border-2 border-white/5 rotate-3" />
                            <div className="absolute inset-0 rounded-[4rem] border-2 border-orange-500/20 rotate-6" />
                            <div className="absolute inset-0 rounded-[4rem] overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/40 via-transparent to-black mix-blend-overlay" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-3xl flex items-center justify-center border border-white/20 animate-pulse">
                                        <Sparkles className="text-orange-500" size={40} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ─── Numbers / Impact ─── */}
            <section className="py-24 border-y border-white/10 bg-neutral-950/50 backdrop-blur-3xl">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                        {[
                            { label: "AI Models Trained", val: "500+" },
                            { label: "Frames Generated", val: "10M+" },
                            { label: "Studio Partners", val: "25+" },
                            { label: "Creator Hours Saved", val: "100k+" }
                        ].map((stat, i) => (
                            <div key={i} className="space-y-2">
                                <h4 className="text-4xl md:text-6xl font-black text-white">{stat.val}</h4>
                                <p className="text-[10px] uppercase font-black tracking-widest text-white/30">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Team / Community CTA ─── */}
            <section className="py-32 relative text-center">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-12">READY TO <span className="text-orange-500">DROP?</span></h2>
                    <p className="text-white/40 mb-12 max-w-xl mx-auto font-medium">No credit card required. No gatekeeping. Just your vision, powered by OKVEVO.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <button 
                            onClick={handleJoinClick}
                            className="w-full sm:w-auto px-12 py-6 rounded-[2rem] bg-orange-600 text-white font-black uppercase tracking-[5px] text-[12px] hover:shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:-translate-y-1 transition-all"
                        >
                            Enter Workspace
                        </button>
                        <button 
                            className="w-full sm:w-auto px-12 py-6 rounded-[2rem] border border-white/10 text-white font-black uppercase tracking-[5px] text-[12px] hover:bg-white/5 transition-all"
                        >
                            View Docs
                        </button>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
