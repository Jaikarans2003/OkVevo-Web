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
    Calendar
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
            // stats: 'Viral',
            description: 'Pick a Trend',
            image: '/WorkSpacePhotos/3.png',
            action: '/workspace/social',
            color: 'bg-[#FFD54F]', // Yellow/Orange
            textColor: 'text-slate-800',
            isLarge: false
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
        <div className="min-h-screen pt-32 pb-16 px-6 md:px-12 bg-black selection:bg-accent-orange/30">
            <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* --- POCKET STYLE AI CREATIVE STUDIO --- */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-4 bg-[#6C5CE7] rounded-[4rem] p-3 flex flex-col relative overflow-hidden h-fit lg:min-h-[725px] shadow-2xl"
                >
                    {/* Top Pocket Section */}
                    <div className="bg-white/10 rounded-[3rem] border-2 border-dashed border-white/30 p-5 mb-4 flex items-center justify-center">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-2">
                                <Zap className="size-5 text-white" />
                            </div>
                            <h2 className="text-xl font-black text-white leading-none uppercase tracking-tighter">AI Creative</h2>
                            <p className="text-white/60 text-[8px] font-bold mt-1 uppercase tracking-widest">Always in your pocket</p>
                        </div>
                    </div>

                    {/* Propped-Up Center Card */}
                    <div className="relative flex-1 flex items-center justify-center py-2">
                        <motion.div 
                            initial={{ rotate: -5, y: 10 }}
                            whileHover={{ rotate: 0, y: 0, scale: 1.05 }}
                            className="relative w-[80%] bg-[#FFF4F2] rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.3)] border-4 border-white p-4 rotate-[-4deg] z-20 cursor-pointer transition-all duration-500"
                        >
                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 px-2 py-1 bg-[#FF6B35]/10 rounded-full border border-[#FF6B35]/20">
                                    <Calendar className="size-2.5 text-[#FF6B35]" />
                                    <span className="text-[8px] font-black text-[#FF6B35] uppercase tracking-tighter">FRI, 19 MAR</span>
                                </div>
                                <div className="w-5 h-5 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
                                    <img src="/gym-avatar.png" className="w-full h-full object-cover" />
                                </div>
                            </div>

                            {/* Card Content */}
                            <div className="mb-4">
                                <p className="text-slate-800 text-[xs] font-bold leading-tight mb-3">
                                    I want a viral hook for my gym persona!
                                </p>
                                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden shadow-sm border border-slate-200">
                                    <img src="/gym-avatar.png" alt="Gym Persona" className="w-full h-full object-cover" />
                                </div>
                                <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                                    <p className="text-[8px] text-slate-600 font-medium tracking-tight">Flow Sync • 4K Mesh • Motion</p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Back-layer Decorative Container */}
                        <div className="absolute inset-x-6 top-10 bottom-10 bg-[#FF6B35] rounded-[3.5rem] shadow-xl z-10 border-2 border-white/20" />
                    </div>

                    {/* Bottom Pocket Section */}
                    <div className="bg-[#FF9FF3]/20 rounded-[2.5rem] border-2 border-dashed border-[#FF9FF3]/40 p-4 mt-4 flex flex-col items-center justify-center">
                        <div className="text-center mb-3">
                            <h3 className="text-lg font-black text-white/90 uppercase tracking-tighter leading-none">Wherever you are</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                             {[
                                 { icon: Camera, color: "bg-white/20 text-white" },
                                 { icon: Video, color: "bg-white/20 text-white" },
                                 { icon: Palette, color: "bg-white/20 text-white" },
                                 { icon: Sparkles, color: "bg-white text-[#6C5CE7]" },
                             ].map((item, i) => (
                                 <button key={i} className={`size-8 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 ${item.color}`}>
                                     <item.icon className="size-4" />
                                 </button>
                             ))}
                        </div>
                    </div>
                </motion.div>

                {/* --- RIGHT FEATURES GRID --- */}
                <div className="lg:col-span-8 flex flex-col gap-10">

                    {/* Heading Area */}
                    <div className="flex items-end justify-between px-4">
                        <h1 className="text-7xl md:text-8xl font-black text-white tracking-tighter">
                            Workspace<span className="text-accent-orange">.</span>
                        </h1>
                    </div>

                    {/* The Bento Grid - Symmetrical 2x2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-[280px]">
                        
                        {/* Director Mode */}
                        {/* <motion.div 
                            whileHover={{ y: -5 }}
                            className="bg-[#A29BFE] rounded-[2.5rem] overflow-hidden group border border-white/20 shadow-xl relative cursor-pointer"
                        > */}
                            {/* <Link href={features[0].action} className="block w-full h-full relative">
                                <div className="absolute top-6 left-8 z-20">
                                    <h3 className="text-4xl font-black text-white mb-2 drop-shadow-lg">{features[0].title}</h3>
                                    <p className="text-white/70 font-bold uppercase tracking-widest text-xs drop-shadow-md">{features[0].description}</p>
                                </div>
                                <div className="absolute top-6 right-8 z-20">
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 group-hover:bg-white group-hover:text-[#A29BFE] transition-all">
                                        <ArrowUpRight className="w-5 h-5 text-white group-hover:text-[#A29BFE]" />
                                    </div>
                                </div> */}
                                {/* Stronger Dual Gradients for Visibility */}
                                {/* <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent z-10" />
                                <img 
                                    src={features[0].image} 
                                    alt={features[0].title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" 
                                /> */}
                                {/* Play pill overlay */}
                                {/* <div className="absolute bottom-6 left-8 z-20 px-5 py-2 bg-white/90 backdrop-blur-md rounded-full flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse" />
                                    <span className="text-black font-black text-[10px] uppercase tracking-widest">Active Preview</span>
                                </div>
                            </Link>
                        </motion.div> */}

                        {/* AI Influencer */}
                        <motion.div 
                            whileHover={{ y: -5 }}
                            className="bg-[#1A1A1A] rounded-[2.5rem] overflow-hidden group border border-white/20 shadow-xl relative cursor-pointer"
                        >
                            <Link href={features[3].action} className="block w-full h-full relative">
                                <div className="absolute top-6 left-8 z-20">
                                    <h3 className="text-4xl font-black text-white mb-2 drop-shadow-lg">{features[3].title}</h3>
                                    <p className="text-accent-orange font-black text-[10px] uppercase tracking-[0.3em] drop-shadow-sm">{features[3].description}</p>
                                </div>
                                <div className="absolute top-6 right-8 z-20">
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 group-hover:bg-white group-hover:text-black transition-all">
                                        <ArrowUpRight className="w-5 h-5 text-white group-hover:text-black" />
                                    </div>
                                </div>
                                {/* Stronger Dual Gradients */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent z-10" />
                                <img 
                                    src={features[3].image} 
                                    alt={features[3].title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" 
                                />
                                {/* Bottom Accent glow */}
                                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-accent-orange/10 rounded-full blur-[80px] z-0" />
                            </Link>
                        </motion.div>

                        {/* Product Studio */}
                        <motion.div 
                            whileHover={{ y: -5 }}
                            className="bg-[#A8E6CF] rounded-[2.5rem] overflow-hidden group border border-white/20 shadow-xl relative cursor-pointer"
                        >
                            <Link href={features[1].action} className="block w-full h-full relative">
                                <div className="absolute top-6 left-8 z-20">
                                    <h3 className="text-4xl font-black text-white mb-2 drop-shadow-lg">{features[1].title}</h3>
                                    <p className="text-white/70 font-bold uppercase tracking-widest text-xs drop-shadow-md">{features[1].description}</p>
                                </div>
                                <div className="absolute top-6 right-8 z-20">
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 group-hover:bg-white group-hover:text-[#A8E6CF] transition-all">
                                        <ArrowUpRight className="w-5 h-5 text-white group-hover:text-[#A8E6CF]" />
                                    </div>
                                </div>
                                {/* Stronger Dual Gradients */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent z-10" />
                                <img 
                                    src={features[1].image} 
                                    alt={features[1].title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" 
                                />
                                <div className="absolute bottom-6 left-8 z-20">
                                    <div className="text-white drop-shadow-lg">
                                        {/* <div className="text-3xl font-black leading-none mb-1">{features[1].stats}</div> */}
                                        {/* <p className="text-[10px] font-bold uppercase tracking-tighter opacity-70">Generation Daily</p> */}
                                    </div>
                                </div>
                            </Link>
                        </motion.div>

                        {/* Social Trends */}
                        <motion.div 
                            whileHover={{ y: -5 }}
                            className="bg-[#FFD54F] rounded-[2.5rem] overflow-hidden group border border-white/20 shadow-xl relative cursor-pointer md:col-span-2"
                        >
                            <Link href={features[2].action} className="block w-full h-full relative">
                                <div className="absolute top-6 left-8 z-20">
                                    <h3 className="text-4xl font-black text-white mb-2 drop-shadow-lg">{features[2].title}</h3>
                                    <p className="text-white/70 font-bold uppercase tracking-widest text-xs drop-shadow-md">{features[2].description}</p>
                                </div>
                                <div className="absolute top-6 right-8 z-20">
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 group-hover:bg-white group-hover:text-[#FFD54F] transition-all">
                                        <ArrowUpRight className="w-5 h-5 text-white group-hover:text-[#FFD54F]" />
                                    </div>
                                </div>
                                {/* Stronger Dual Gradients */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent z-10" />
                                <img 
                                    src={features[2].image} 
                                    alt={features[2].title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" 
                                />
                                <div className="absolute bottom-6 left-8 z-20">
                                    <div className="text-white drop-shadow-lg">
                                        {/* <div className="text-3xl font-black leading-none mb-1">{features[2].stats}</div> */}
                                        {/* <p className="text-[10px] font-bold uppercase tracking-tighter opacity-70">Trends Sync</p> */}
                                    </div>
                                </div>
                            </Link>
                        </motion.div>

                        
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceBento;
