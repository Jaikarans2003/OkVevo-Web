"use client";

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getThemeClasses } from '../../../utils/themeUtils';

export default function OnboardingWelcomePage() {
    const router = useRouter();
    // Force dark theme for onboarding
    const tc = getThemeClasses('dark');

    const handleStart = () => {
        router.push('/onboarding/profile');
    };

    return (
        <div className={`min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden`}>

            {/* Ambient Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-orange-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse-slower" />
            </div>

            {/* Content Container */}
            <main className="relative z-10 flex flex-col items-center text-center max-w-4xl px-6 w-full">

                {/* Logo / Brand Element */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="mb-12"
                >
                    <div className="inline-flex items-center gap-2.5 bg-white/5 backdrop-blur-sm border border-white/10 px-5 py-2.5 rounded-full">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/Orange.svg"
                            alt="Logo"
                            width={24}
                            height={24}
                            className="w-5 h-5 object-contain"
                        />
                        <span className="font-black tracking-tighter text-orange-100/90 text-xl">
                            OKVEVO<span className="w-1.5 h-1.5 rounded-full bg-accent-orange inline-block ml-1 animate-pulse" />
                        </span>
                    </div>
                </motion.div>

                {/* Main Heading */}
                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent"
                >
                    Explore what you<br />can do with <span className="text-white">OKVEVO</span>
                </motion.h1>

                {/* CTA Button */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStart}
                    className="group relative px-10 py-4 bg-accent-orange hover:bg-orange-500 rounded-full font-bold text-lg transition-all shadow-[0_0_40px_-10px_rgba(255,109,31,0.5)] hover:shadow-[0_0_60px_-10px_rgba(255,109,31,0.7)] overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <span className="relative z-10 flex items-center gap-2">
                        Let's Start <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                </motion.button>

            </main>

            {/* Footer / Decorative Lines */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1.5 }}
                className="absolute bottom-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />
            <div className="absolute left-0 bottom-0 h-[400px] w-px bg-gradient-to-t from-orange-500/0 via-orange-500/20 to-orange-500/0 skew-x-12 opacity-30" />
            <div className="absolute right-0 bottom-0 h-[400px] w-px bg-gradient-to-t from-orange-500/0 via-orange-500/20 to-orange-500/0 -skew-x-12 opacity-30" />
        </div>
    );
}
