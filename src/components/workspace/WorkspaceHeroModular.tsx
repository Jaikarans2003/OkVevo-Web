'use client';

import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, FileText, TrendingUp, ShoppingBag, User } from 'lucide-react';

const DashHeroModular = ({ user }: { user?: any }) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const displayName = user?.displayName?.split(' ')?.[0] || user?.email?.split('@')?.[0] || 'Aditya';

    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        const x = (clientX / innerWidth - 0.5) * 2;
        const y = (clientY / innerHeight - 0.5) * 2;
        setMousePosition({ x, y });
    };

    const floatingVariant = (factor: number) => ({
        x: mousePosition.x * factor * 20,
        y: mousePosition.y * factor * 20,
        transition: {
            type: "spring" as const,
            stiffness: 50,
            damping: 20
        }
    });

    const suggestions = [
        {
            icon: FileText,
            label: 'Director Mode',
            action: '/workspace/director',
            iconColor: 'bg-yellow-400/20 text-yellow-500',
            indicator: 'Generate Trailer',
        },

        {
            icon: ShoppingBag,
            label: 'Product Studio',
            action: '/workspace/product',
            iconColor: 'bg-blue-400/20 text-blue-500',
            indicator: 'Brand Boost',
        },
        {
            icon: TrendingUp,
            label: 'Instagram Trends',
            action: '/workspace/social',
            iconColor: 'bg-pink-400/20 text-pink-500',
            indicator: 'Create Content',
        },
        {
            icon: User,
            label: 'AI Influencer',
            action: '/workspace/ai-avatar',
            iconColor: 'bg-green-400/20 text-green-500',
            indicator: 'Social Sync',
        },
    ];

    return (
        <section
            onMouseMove={handleMouseMove}
            className="relative min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden"
        >
            {/* Tighter Dotted Grid */}
            <div
                className="absolute inset-0 opacity-[0.25] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}
            />

            {/* Floating Elements with Cursor Follow */}
            <motion.div
                animate={floatingVariant(1.2)}
                className="absolute top-[18%] left-[8%] w-24 h-24 md:w-32 md:h-32 z-30 hidden lg:block"
            >
                <Image src="/images/redesign/crystal_ball_white_bg.png" alt="Crystal Ball" width={128} height={128} className="object-contain mix-blend-multiply" priority />
            </motion.div>

            <motion.div
                animate={floatingVariant(0.8)}
                className="absolute top-[22%] right-[10%] w-28 h-28 md:w-36 md:h-36 z-30 hidden lg:block"
            >
                <Image src="/images/redesign/nft_card_white_bg.png" alt="NFT Card" width={144} height={144} className="object-contain mix-blend-multiply" priority />
            </motion.div>

            <motion.div
                animate={floatingVariant(1.5)}
                className="absolute bottom-[25%] right-[5%] w-32 h-32 md:w-44 md:h-44 z-30 hidden lg:block"
            >
                <Image src="/images/redesign/eyes_square_white_bg.png" alt="Eyes" width={176} height={176} className="object-contain mix-blend-multiply" priority />
            </motion.div>

            {/* Central Content */}
            <div className="relative z-20 text-center w-full max-w-5xl px-6">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 bg-black px-5 py-2 rounded-full mb-10 shadow-xl"
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                    <span className="text-[10px] md:text-xs font-black tracking-widest text-white uppercase">Zero Camera, Infinite Vision.</span>
                </motion.div>

                {/* Typography */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-medium text-gray-400 mb-2">Welcome,</h2>
                    <h1 className="text-7xl md:text-9xl font-black text-black tracking-tighter leading-[0.85] mb-6 capitalize px-4">
                        {displayName}
                    </h1>
                    <div className="text-4xl md:text-6xl font-black tracking-tight text-white flex items-center justify-center">
                        <span className="text-black mr-3">I am</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#F43F5E]">VEVO</span>
                    </div>
                </motion.div>

                {/* Actions Grid Container */}
                <div className="relative w-full max-w-4xl mx-auto">
                    {/* Floating Element Connection Box */}
                    <motion.div
                        animate={floatingVariant(0.5)}
                        className="absolute left-[-160px] top-1/2 -translate-y-1/2 hidden xl:flex items-center z-10"
                    >
                        <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-gray-100 w-44 h-44 flex flex-col items-center justify-center -rotate-6">
                            <span className="text-xs font-bold text-gray-400 mb-1">Floating</span>
                            <span className="text-xs font-bold text-gray-400">Element</span>
                        </div>
                        <div className="w-12 h-[1px] bg-gray-200 relative ml-2">
                            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-300" />
                        </div>
                    </motion.div>

                    {/* Suggestions Grid */}
                    <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-[3rem] p-4 md:p-8 shadow-2xl scale-95 md:scale-100 relative z-20">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {suggestions.map((item, index) => (
                                <Link key={index} href={item.action} className="relative group">
                                    {/* Hover Arrow/Label */}
                                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none translate-y-2 group-hover:translate-y-0">
                                        <div className="bg-[#121212] text-white text-[9px] font-black px-4 py-2 rounded-xl whitespace-nowrap shadow-2xl tracking-widest uppercase">
                                            {item.indicator}
                                        </div>
                                        <div className="w-[1px] h-4 bg-gray-300 mx-auto mt-1" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mx-auto" />
                                    </div>

                                    <div className="w-full aspect-square flex flex-col items-center justify-center p-6 bg-[#121212] rounded-[2.5rem] transition-all duration-300 hover:scale-[1.05] group-hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] cursor-pointer">
                                        <div className={`p-4 rounded-2xl mb-4 transition-colors ${item.iconColor}`}>
                                            <item.icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] md:text-[11px] font-black text-white/50 tracking-[0.1em] uppercase group-hover:text-white transition-colors text-center leading-tight">
                                            {item.label}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DashHeroModular;
