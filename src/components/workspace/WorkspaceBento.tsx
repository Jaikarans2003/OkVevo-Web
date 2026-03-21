'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import {
    Video,
    Zap,
    ArrowUpRight,
    Sparkles,
    PenTool,
    Palette,
    Settings,
    Plus,
    Camera,
    Image as ImageIcon,
    Type,
    Circle,
    Calendar,
    Twitter,
    Linkedin,
    Github,
    MonitorPlay,
    Instagram
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface WorkspaceBentoProps {
    user?: any;
}

const WorkspaceBento = ({ user: initialUser }: WorkspaceBentoProps) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(initialUser);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        // Handle auth state changes
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                // Fetch fresh profile from Firestore
                try {
                    const profile = await getUserProfile(currentUser.uid);
                    setUserProfile(profile);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Prioritize Firestore data, then Auth data, then defaults
    const displayName = userProfile?.organisationName || user?.displayName || 'User';
    const firstInitial = displayName.charAt(0);
    const email = user?.email || userProfile?.email;
    const avatarUrl = user?.photoURL || userProfile?.photoURL;

    const features = [
        {
            id: 'director',
            title: 'Director Mode',
            description: 'Cinema AI Studio',
            subtitle: 'Generate cinematic trailers in seconds',
            image: '/WorkSpacePhotos/1.png',
            action: '/workspace/director',
            color: 'bg-[#A29BFE]', // Purple
            textColor: 'text-white',
            isLarge: true
        },
        {
            id: 'product',
            title: 'Product Studio',
            // stats: 'Create',
            description: 'Brand Boost',
            image: '/WorkSpacePhotos/2.jpg',
            action: '/workspace/product',
            color: 'bg-[#A8E6CF]', // Teal
            textColor: 'text-slate-800',
            isLarge: false
        },
        {
            id: 'social',
            title: 'Instagram Trends',
            description: 'Pick a Trend',
            subtitle: 'Viral content at your fingertips',
            image: '/WorkSpacePhotos/3.png',
            action: '/workspace/social',
            color: 'bg-[#1A1A1A]', // Dark
            textColor: 'text-white',
            isWide: true
        },
        {
            id: 'ai-influencer',
            title: 'AI Influencer',
            description: 'Your Twin',
            subtitle: 'Infinite scale for your digital persona',
            image: '/WorkSpacePhotos/4.jpg',
            action: '/workspace/ai-influencer',
            color: 'bg-[#333333]', // Dark
            textColor: 'text-white',
            isWide: true
        }
    ];

    // const navItems = [
    //     { name: 'Dashboard', icon: Home },
    //     { name: 'Projects', icon: Layers },
    //     { name: 'Settings', icon: Settings },
    //     { name: 'Logout', icon: LogOut },
    // ];

    return (
        <div 
            className="min-h-screen pt-32 pb-16 px-6 md:px-12 relative selection:bg-accent-orange/30 overflow-x-hidden"
            style={{
                backgroundImage: 'url("/images/workspace-bg.png")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
            }}
        >
            {/* Dark Overlay for Readability */}
            <div className="absolute inset-0 bg-[#050505]/40 backdrop-blur-[2px] pointer-events-none" />

            <div className="max-w-[1400px] mx-auto relative z-10">
                
                {/* --- MAIN BENTO GRID --- */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 auto-rows-[340px]">
                    
                    {/* CARD 1: PLATFORM OFFERING (Top Left - Wide) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.01 }}
                        className="lg:col-span-8 bg-[#111111] rounded-[2.5rem] p-10 flex flex-col justify-between relative overflow-hidden group border border-white/20 shadow-2xl"
                    >
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 rounded-2xl bg-accent-orange/10 border border-accent-orange/20 flex items-center justify-center">
                                        <Sparkles className="text-accent-orange size-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm tracking-tight uppercase">Platform Offering</h4>
                                        <p className="text-white/30 text-[10px] font-medium uppercase tracking-[0.2em]">Next-Gen Studio</p>
                                    </div>
                                </div>

                                <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tighter leading-[0.95] mb-6">
                                    Generate <span className="text-accent-orange">Cinematic AI</span> <br/> Content in seconds.
                                </h1>

                                <p className="max-w-md text-white/50 text-sm leading-relaxed font-light">
                                    Push the boundaries of storytelling with our suite of AI tools. From cinematic trailers to viral trends, we provide everything you need to scale your vision.
                                </p>
                            </div>

                            <div className="flex items-center gap-6 mt-8">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-[#111111] bg-white/10 overflow-hidden">
                                            <img src={`/WorkSpacePhotos/${i}.png`} onError={(e) => (e.currentTarget.src = `/WorkSpacePhotos/${i}.jpg`)} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                                <div className="h-10 w-px bg-white/10" />
                                <div>
                                    <p className="text-white font-bold text-sm leading-none">10k+</p>
                                    <p className="text-white/30 text-[10px] uppercase font-bold tracking-widest mt-1">Generations</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Interactive Shine */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-accent-orange/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    </motion.div>

                    {/* CARD 2: PERSONA / AVATAR (Top Right - Small) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05, rotate: 1 }}
                        className="lg:col-span-4 bg-white rounded-[2.5rem] relative overflow-hidden flex items-center justify-center p-8 group overflow-hidden border border-white/10"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-accent-orange to-[#FFB347] opacity-90 group-hover:scale-110 transition-transform duration-700" />
                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                            <img 
                                src="/gym-avatar.png" 
                                alt="Persona" 
                                className="w-[85%] h-auto drop-shadow-2xl brightness-110 group-hover:scale-105 transition-transform duration-500" 
                            />
                        </div>
                        {/* Decorative Sparkles */}
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                            className="absolute top-8 right-8"
                        >
                            <Sparkles className="text-white/40 size-6" />
                        </motion.div>
                    </motion.div>

                    {/* CARD 3: AI INFLUENCER (Bottom Left - Tall/Square - Orange Card) */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ y: -5 }}
                        className="lg:col-span-4 bg-[#FF6B35] rounded-[2.5rem] p-10 flex flex-col justify-between relative overflow-hidden group shadow-2xl cursor-pointer"
                    >
                        <Link href="/workspace/ai-influencer" className="absolute inset-0 z-10" />
                        
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 text-black/60 font-black text-[9px] uppercase tracking-[0.3em]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-black/40 animate-pulse" />
                                    High Scale
                                </div>
                                <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center group-hover:bg-black group-hover:text-orange-500 transition-all">
                                    <ArrowUpRight className="size-4" />
                                </div>
                            </div>
                            
                            <div>
                                <h2 className="text-[2.75rem] font-bold text-black tracking-tighter leading-[0.9] mb-4">
                                    AI <br/> Influencer <br/> Studio.
                                </h2>
                                <p className="text-black/70 text-[13px] font-bold leading-relaxed max-w-[200px]">
                                    Build your digital twin and scale your persona infinitely.
                                </p>
                            </div>

                            {/* Refined Floating Visual Modules */}
                            <div className="absolute top-24 -right-4 w-20 h-20 opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity duration-700">
                                <Sparkles className="text-black size-full" />
                            </div>
                            
                            <div className="relative h-16 flex items-center gap-4 mt-4">
                                <motion.div 
                                    animate={{ y: [0, -4, 0], rotate: [0, 5, 0] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-12 h-12 bg-black/10 backdrop-blur-xl rounded-2xl border border-black/5 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                                >
                                    <Video className="text-black/60 size-6" />
                                </motion.div>
                                <div className="h-px bg-black/10 flex-1" />
                            </div>
                        </div>

                        {/* Interactive Grid Overlay */}
                        <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none" style={{ backgroundImage: 'radial-gradient(black 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                    </motion.div>

                    {/* CARD 4: VIRAL TRENDS (Bottom Right - Horizontal Split Layout) */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: 1.01 }}
                        className="lg:col-span-8 bg-[#111111] rounded-[2.5rem] overflow-hidden group relative border border-white/10 shadow-2xl flex flex-col md:flex-row"
                    >
                        <Link href="/workspace/social" className="flex flex-col md:flex-row w-full h-full relative p-8 md:p-12 gap-10">
                            {/* Left Side: Content */}
                            <div className="flex-1 flex flex-col justify-center relative z-20">
                                <div className="flex items-center gap-2 text-accent-orange font-black text-[9px] uppercase tracking-[0.3em] mb-4">
                                    <Instagram size={12} />
                                    Viral Studio
                                </div>
                                <h3 className="text-[2.75rem] font-bold text-white tracking-tighter leading-[0.95] mb-6">
                                    Social Media <br /> Trends Hub
                                </h3>
                                <p className="text-white/40 text-sm font-medium leading-relaxed max-w-[320px] mb-8">
                                    Spot global trends in real-time and convert them into cinematic content with a single click.
                                </p>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-black transition-all">
                                        <ArrowUpRight className="size-6" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/60 transition-colors">Enter Trends Studio</span>
                                </div>
                            </div>

                            {/* Right Side: Visual Preview */}
                            <div className="flex-1 relative rounded-[2.5rem] overflow-hidden border border-white/10 shadow-3xl bg-black/40 group-hover:border-accent-orange/30 transition-all duration-700 min-h-[300px]">
                                <img 
                                    src="/WorkSpacePhotos/3.png" 
                                    className="absolute inset-0 w-full h-full object-contain p-8 group-hover:scale-[1.05] transition-transform duration-1000 brightness-90 group-hover:brightness-110" 
                                    alt="Trends Preview"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-60" />
                                
                                {/* Floating Label */}
                                <motion.div 
                                    animate={{ y: [0, -5, 0] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute bottom-6 right-6 bg-[#111111]/80 backdrop-blur-2xl border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 shadow-2xl"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                    <span className="text-[8px] font-black uppercase tracking-widest text-white/50">Tracking 50+ Trends</span>
                                </motion.div>
                            </div>
                        </Link>
                    </motion.div>

                </div>

                {/* --- QUICK ACCESS STUDIOS (Lower Section) --- */}
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { id: 'influencer', title: 'AI Influencer', path: '/workspace/ai-influencer', desc: 'Digital Twin Generator', icon: Sparkles, img: '/WorkSpacePhotos/4.jpg' },
                        { id: 'social', title: 'Instagram Studio', path: '/workspace/social', desc: 'Viral Trend Machine', icon: Instagram, img: '/WorkSpacePhotos/3.png' },
                        { id: 'product', title: 'Product Studio', path: '/workspace/product', desc: 'Brand Visual Engine', icon: Camera, img: '/WorkSpacePhotos/2.jpg' },
                    ].map((studio) => (
                        <motion.div
                            key={studio.id}
                            whileHover={{ y: -5 }}
                            className="bg-[#111111] rounded-[2rem] border border-white/5 p-6 relative overflow-hidden group cursor-pointer"
                        >
                            <Link href={studio.path} className="flex items-center gap-5">
                                <div className="z-10 w-16 h-16 rounded-2xl overflow-hidden bg-black/40 border border-white/10 p-0.5">
                                    <img src={studio.img} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="z-10">
                                    <h4 className="text-white font-bold group-hover:text-accent-orange transition-colors">{studio.title}</h4>
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{studio.desc}</p>
                                </div>
                                <ArrowUpRight className="ml-auto size-4 text-white/20 group-hover:text-accent-orange transition-all" />
                            </Link>
                            <div className="absolute inset-0 bg-accent-orange/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                    ))}
                </div>

            </div>
        </div>
    );
};

export default WorkspaceBento;
