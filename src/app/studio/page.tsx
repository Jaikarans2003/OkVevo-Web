"use client";

import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, Users, ShoppingBag, Video, Activity, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function StudioPage() {
    const router = useRouter();

    const features = [
        {
            id: 'fe-1', // Stable ID
            title: 'Chat with Vevo',
            desc: 'Get Cinematic Input. Create up to 60 seconds of video content.',
            icon: MessageSquare,
            gradient: 'from-orange-500 to-red-600',
            bg: 'bg-orange-900/10',
            border: 'hover:border-orange-500/50',
            textColor: 'text-accent-orange',
            path: '/chat'
        },
        {
            id: 'fe-2',
            title: 'AI Avatars',
            desc: 'Create lifelike Face and Full-body avatars.',
            icon: Users,
            gradient: 'from-emerald-500 to-green-600',
            bg: 'bg-emerald-900/10',
            border: 'hover:border-emerald-500/50',
            textColor: 'text-emerald-400',
            path: '/studio/avatars'
        },
        {
            id: 'fe-3',
            title: 'Product Studio',
            desc: 'Product Placement, Product Shoots, BTS Videos & Ads.',
            icon: ShoppingBag,
            gradient: 'from-purple-500 to-pink-600',
            bg: 'bg-purple-900/10',
            border: 'hover:border-purple-500/50',
            textColor: 'text-purple-400',
            path: '/studio/product'
        },
        {
            id: 'fe-4',
            title: 'UGC Factory',
            desc: 'Select Avatar/Template, Custom Actions (Walking, Smiling), Audio & Text.',
            icon: Video,
            gradient: 'from-orange-500 to-red-600',
            bg: 'bg-orange-900/10',
            border: 'hover:border-orange-500/50',
            textColor: 'text-orange-400',
            path: '/studio/ugc'
        },
        {
            id: 'fe-5',
            title: 'AI Influencer',
            desc: 'Advanced Motion Control for AI Influencers.',
            icon: Activity,
            gradient: 'from-cyan-500 to-blue-600',
            bg: 'bg-cyan-900/10',
            border: 'hover:border-cyan-500/50',
            textColor: 'text-cyan-400',
            path: '/studio/influencer'
        }
    ];

    const handleNavigation = (path: string) => {
        router.push(path);
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-start min-h-[80vh] pt-8">
            <div className="max-w-6xl w-full">

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 bg-accent-orange/10 px-4 py-1.5 rounded-full mb-6 border border-accent-orange/20">
                        <Sparkles className="w-4 h-4 text-accent-orange" />
                        <span className="text-accent-orange font-bold tracking-wide uppercase text-xs">Creative Suite</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight text-white">
                        AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-orange to-red-500">Studio</span>
                    </h1>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        Select a tool to start creating amazing content.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.button
                            key={feature.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            onClick={() => handleNavigation(feature.path)}
                            className={`group relative ${feature.bg} p-8 rounded-[24px] border border-white/5 ${feature.border} text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden h-full flex flex-col`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <div className="relative z-10 flex flex-col h-full">
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                                    <feature.icon className="w-7 h-7 text-white" />
                                </div>

                                <h3 className="text-2xl font-bold mb-3 text-white group-hover:text-white transition-colors">
                                    {feature.title}
                                </h3>

                                <p className="text-gray-400 text-sm leading-relaxed mb-8 flex-1">
                                    {feature.desc}
                                </p>

                                <div className={`mt-auto flex items-center gap-2 ${feature.textColor} font-bold text-sm group-hover:gap-4 transition-all opacity-80 group-hover:opacity-100`}>
                                    Launch Tool <ArrowRight className="w-4 h-4" />
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>

            </div>
        </div>
    );
}
