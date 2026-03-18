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
    ArrowUpRight
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import DisplayCards from '@/components/ui/display-cards';

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

                {/* --- LEFT CENTRAL DASHBOARD SECTION --- */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-4 bg-[#FF4D00] rounded-[3.5rem] p-8 md:p-10 flex flex-col relative overflow-hidden h-fit lg:min-h-[720px] shadow-2xl text-white"
                >
                    {/* Top Right Logo Accent */}
                    <div className="absolute top-8 right-8 text-white/20 text-[10px] font-black tracking-widest uppercase">
                        OKVEVO
                    </div>
                    
                    {/* Header */}
                    <div className="mb-8 relative z-10">
                        <h2 className="text-5xl font-black leading-none mb-1 tracking-tight">
                            CENTRAL
                        </h2>
                        <h2 className="text-5xl font-medium leading-none tracking-tight opacity-70">
                            DASHBOARD
                        </h2>
                    </div>

                    {/* Stats/Offering Grid (Matching Image) */}
                    <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                        {/* Persona: Influencers */}
                        <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-6 border border-white/5 flex flex-col h-[120px] group cursor-pointer hover:bg-white/20 transition-all duration-300">
                             <Zap className="size-4 mb-4 text-white/50 group-hover:text-white transition-colors" />
                             <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">PERSONA</p>
                                <p className="text-xl font-black leading-tight">INFLUENCERS</p>
                             </div>
                        </div>

                        {/* Trends: Popular */}
                        <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-6 border border-white/5 flex flex-col h-[120px] group cursor-pointer hover:bg-white/20 transition-all duration-300">
                             <TrendingUp className="size-4 mb-4 text-white/50 group-hover:text-white transition-colors" />
                             <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">TRENDS</p>
                                <p className="text-xl font-black leading-tight">POPULAR</p>
                             </div>
                        </div>

                        {/* Studio: Ad-Gen */}
                        <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-6 border border-white/5 flex flex-col h-[120px] group cursor-pointer hover:bg-white/20 transition-all duration-300">
                             <Palette className="size-4 mb-4 text-white/50 group-hover:text-white transition-colors" />
                             <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">STUDIO</p>
                                <p className="text-xl font-black leading-tight">Ad-Gen</p>
                             </div>
                        </div>

                        {/* Cinema: Directing */}
                        <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-6 border border-white/5 flex flex-col h-[120px] group cursor-pointer hover:bg-white/20 transition-all duration-300">
                             <Video className="size-4 mb-4 text-white/50 group-hover:text-white transition-colors" />
                             <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">CINEMA</p>
                                <p className="text-xl font-black leading-tight">Directing</p>
                             </div>
                        </div>
                    </div>

                    {/* Bottom Tilted Cards Area */}
                    <div className="relative pb-10">
                        {/* Subtle Glow Only */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-[300px] pointer-events-none z-0 overflow-visible translate-y-20 scale-110">
                             <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-orange-400/40 via-orange-400/10 to-transparent blur-2xl rounded-[50%]" />
                        </div>

                        {/* Tilted Cards (Offering Display) */}
                        <div className="relative z-10 flex flex-col items-start translate-x-[-10px]">
                            <div className="scale-[0.7] md:scale-[0.8] origin-left -mb-10 lg:-mb-20">
                                <DisplayCards cards={[
                                    {
                                        icon: <Zap className="size-4 text-orange-200" />,
                                        title: "Influencers",
                                        description: "Persona AI Studio",
                                        date: "Brand New",
                                        iconClassName: "text-white",
                                        titleClassName: "text-white",
                                        className: "[grid-area:stack] hover:-translate-y-8 before:absolute before:w-[100%]  before:rounded-xl before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-white/5 grayscale-[20%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0 bg-white/5 backdrop-blur-md",
                                    },
                                    {
                                        icon: <TrendingUp className="size-4 text-orange-200" />,
                                        title: "Popular",
                                        description: "Viral Trends Sync",
                                        date: "Updated Today",
                                        iconClassName: "text-white",
                                        titleClassName: "text-white",
                                        className: "[grid-area:stack] translate-x-10 translate-y-4 hover:-translate-y-4 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-white/20 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-white/5 grayscale-[20%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0 bg-white/10 backdrop-blur-md",
                                    },
                                    {
                                        icon: <Palette className="size-4 text-orange-200" />,
                                        title: "Ad-Gen",
                                        description: "Product Studio",
                                        date: "2 days ago",
                                        iconClassName: "text-white",
                                        titleClassName: "text-white",
                                        className: "[grid-area:stack] translate-x-20 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-white/20 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-white/5 grayscale-[20%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0 bg-white/10 backdrop-blur-md",
                                    },
                                    {
                                        icon: <Video className="size-4 text-orange-200" />,
                                        title: "Directing",
                                        description: "Cinema AI Engine",
                                        date: "Just Now",
                                        iconClassName: "text-white",
                                        titleClassName: "text-white",
                                        className: "[grid-area:stack] translate-x-28 translate-y-16 hover:translate-y-8 bg-white/10  backdrop-blur-md border border-white/20",
                                    },
                                ]} />
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
