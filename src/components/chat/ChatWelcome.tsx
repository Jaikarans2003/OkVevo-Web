"use client";

import { FileText, TrendingUp, ShoppingBag, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface ChatWelcomeProps {
    onSuggestionClick: (suggestion: string) => void;
}

export default function ChatWelcome({ onSuggestionClick }: ChatWelcomeProps) {
    const { user } = useAuth();
    const displayName = user?.displayName?.split(' ')[0] || 'Friend';

    const suggestions = [
        {
            icon: FileText,
            label: 'From a Script',
            action: 'Generate a video from a script...',
            iconColor: 'text-yellow-400',
            bgColor: 'bg-[#1A1A1A]',
            indicator: 'Generate Trailer',
            indicatorPos: '-top-10 left-1/2 -translate-x-1/2'
        },
        {
            icon: TrendingUp,
            label: 'Instagram Trends',
            action: 'Create a trending Instagram reel...',
            iconColor: 'text-pink-400',
            bgColor: 'bg-[#1A1A1A]'
        },
        {
            icon: ShoppingBag,
            label: 'Product Studio',
            action: 'Create a product video...',
            iconColor: 'text-blue-400',
            bgColor: 'bg-[#1A1A1A]'
        },
        {
            icon: User,
            label: 'AI Influencer',
            action: 'Create an AI influencer content...',
            iconColor: 'text-green-400',
            bgColor: 'bg-[#1A1A1A]'
        },
    ];

    return (
        <div className="relative flex flex-col items-center justify-center min-h-full w-full max-w-7xl mx-auto px-4 py-12 bg-[#FAFAFA] rounded-[60px] my-4 shadow-2xl overflow-hidden">
            {/* Dotted Background */}
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#D1D1D1 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}
            />

            {/* Floating Elements (Background) */}
            <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-12 left-8 md:top-20 md:left-20 w-24 h-24 md:w-32 md:h-32 z-10 hidden sm:block"
            >
                <Image src="/images/redesign/crystal_ball.png" alt="Crystal Ball" width={128} height={128} className="object-contain" priority />
            </motion.div>

            <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-24 right-8 md:top-32 md:right-32 w-28 h-28 md:w-40 md:h-40 z-10 hidden sm:block"
            >
                <Image src="/images/redesign/nft_card.png" alt="NFT Card" width={160} height={160} className="object-contain" priority />
            </motion.div>

            <motion.div
                animate={{ x: [0, 10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-20 right-8 md:bottom-24 md:right-24 w-32 h-32 md:w-48 md:h-48 z-10 hidden sm:block"
            >
                <Image src="/images/redesign/eyes_square.png" alt="Eyes" width={192} height={192} className="object-contain" priority />
            </motion.div>

            {/* Main Content */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-20 flex flex-col items-center text-center w-full max-w-4xl"
            >
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-black px-4 py-1.5 rounded-full mb-10 shadow-lg scale-90 md:scale-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                    <span className="text-[10px] md:text-xs font-black tracking-widest text-white uppercase">Zero team but the work gets done.</span>
                </div>

                {/* Heading */}
                <div className="mb-16">
                    <h2 className="text-3xl md:text-4xl text-[#999] font-medium mb-1">Welcome,</h2>
                    <h1 className="text-6xl md:text-9xl font-black text-black tracking-tight leading-[0.9] mb-4">
                        {displayName.toLowerCase()}
                    </h1>
                    <div className="text-3xl md:text-5xl font-black tracking-tight text-white flex items-center justify-center">
                        <span className="text-black mr-3">I am</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#F43F5E]">VEVO</span>
                    </div>
                </div>

                {/* Suggestions Section */}
                <div className="w-full relative px-4">
                    {/* Floating Element Connection (Left) */}
                    <div className="absolute left-[-20px] top-1/2 -translate-y-1/2 hidden lg:flex items-center">
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100 w-32 h-32 flex flex-col items-center justify-center">
                            <div className="text-[10px] font-bold text-gray-400 mb-1">Floating</div>
                            <div className="text-[10px] font-bold text-gray-400">Element</div>
                        </div>
                        <div className="w-12 h-[1px] bg-gray-300 relative">
                            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-300" />
                        </div>
                    </div>

                    <div className="bg-white/40 backdrop-blur-md border border-white rounded-[3rem] p-4 md:p-8 shadow-2xl overflow-hidden">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {suggestions.map((item, index) => (
                                <div key={index} className="relative group">
                                    {item.indicator && (
                                        <div className={`absolute ${item.indicatorPos} z-30 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity`}>
                                            <div className="bg-black text-white text-[8px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-lg mb-1">
                                                {item.indicator}
                                            </div>
                                            <div className="w-[1px] h-4 bg-gray-400 mx-auto" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => onSuggestionClick(item.action)}
                                        className="w-full aspect-square md:h-40 flex flex-col items-center justify-center p-6 bg-[#121212] rounded-[2rem] transition-all duration-300 hover:scale-[1.05] group-hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]"
                                    >
                                        <div className="bg-white/5 p-4 rounded-xl mb-3 group-hover:bg-white/10 transition-colors">
                                            <item.icon className={`w-5 h-5 md:w-6 md:h-6 ${item.iconColor}`} />
                                        </div>
                                        <span className="text-[10px] md:text-[11px] font-bold text-white/70 tracking-wide uppercase group-hover:text-white transition-colors">
                                            {item.label}
                                        </span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
