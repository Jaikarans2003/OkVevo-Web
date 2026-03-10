'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import {
    Video,
    Palette,
    TrendingUp,
    Zap,
    Home,
    Layers,
    Settings,
    LogOut,
    ArrowUpRight,
    Search
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

                {/* --- LEFT PROFILE SECTION --- */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-4 bg-[#FF4D00] rounded-[3rem] p-10 flex flex-col relative overflow-hidden h-fit lg:min-h-[584px] shadow-2xl"
                >
                    {/* Top Accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[4rem]" />

                    <div className="relative z-10 flex flex-col h-full">
                        {/* Profile Image & Meta */}
                        <div className="mb-10">
                            <div className="w-32 h-32 rounded-full border-4 border-white/30 p-2 mb-6 relative">
                                <div className="w-full h-full rounded-full bg-white/20 overflow-hidden flex items-center justify-center text-3xl font-black text-white">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        firstInitial
                                    )}
                                </div>
                                <div className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                </div>
                            </div>

                            <h2 className="text-4xl font-black text-white leading-none mb-3">
                                Im,<br />{displayName}
                            </h2>
                            <p className="text-white/70 font-medium text-sm border-b border-white/20 pb-4 inline-block">
                                {email}
                            </p>
                        </div>

                        {/* Navigation / Sidebar Menu (Vertical) */}
                        <div className="flex flex-col gap-8 mt-4">
                            {['Studio', 'Research', 'Templates', 'Insights'].map((item) => (
                                <button key={item} className="text-left w-fit group">
                                    <span className="text-sm font-black uppercase tracking-[0.3em] text-white/50 group-hover:text-white transition-colors duration-300 transform group-hover:translate-x-2 inline-block">
                                        {item}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Bottom Disc Badge (Matching Reference) */}
                        <div className="mt-auto pt-12 self-end">
                            <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center border-4 border-white/10 relative group cursor-pointer hover:rotate-12 transition-transform duration-500">
                                {/* <div className="absolute inset-0 rounded-full border border-dashed border-white/20 animate-spin-slow" /> */}
                                {/* <div className="text-[8px] font-black text-white text-center uppercase tracking-tighter">
                                    My<br />Studio<br />2026
                                </div> */}
                            </div>
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
                            className="bg-[#FFD54F] rounded-[2.5rem] overflow-hidden group border border-white/20 shadow-xl relative cursor-pointer"
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
