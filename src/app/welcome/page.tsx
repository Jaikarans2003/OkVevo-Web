"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { MessageSquare, Wand2, ArrowRight, Loader2, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import NoiseOverlay from '../../components/NoiseOverlay';
import { motion } from 'framer-motion';

function WelcomePageContent() {
    const router = useRouter();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push('/login');
            } else {
                setUser(currentUser);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleChat = () => {
        router.push('/chat');
    };

    const handleAIStudio = () => {
        router.push('/studio');
    };

    if (loading) {
        return (
            <div className={`min-h-screen ${tc.bg} flex items-center justify-center`}>
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${tc.bg} ${tc.text} flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
            {resolvedTheme === 'light' && <NoiseOverlay />}

            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-orange/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
            </div>

            {/* Theme Toggle */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={() => {
                        const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                        setTheme(nextTheme);
                    }}
                    className={`p-3 ${tc.sidebar} rounded-2xl hover:scale-110 transition-all duration-300 shadow-lg group relative`}
                >
                    {theme === 'light' ? (
                        <Moon className={`w-5 h-5 ${tc.text}`} />
                    ) : theme === 'dark' ? (
                        <svg className={`w-5 h-5 ${tc.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    ) : (
                        <Sun className={`w-5 h-5 ${tc.text}`} />
                    )}
                </button>
            </div>

            <div className="relative z-10 w-full max-w-6xl">
                {/* Logo & Welcome */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <Link href="/" className="inline-block mb-8">
                        <div className="relative w-24 h-24 mx-auto hover:scale-110 transition-transform duration-500">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                fill
                                className="object-contain"
                            />
                        </div>
                    </Link>
                    <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
                        Welcome to <span className="text-accent-orange">OKVEVO</span>
                    </h1>
                    <p className={`text-xl md:text-2xl ${tc.textDim} max-w-2xl mx-auto leading-relaxed`}>
                        Where would you like to start your creative journey today?
                    </p>
                </motion.div>

                {/* Cards Container */}
                <div className="grid md:grid-cols-2 gap-8 px-4 max-w-4xl mx-auto">
                    {/* Chat Features Card */}
                    <motion.button
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        onClick={handleChat}
                        className={`group relative ${tc.card} rounded-[40px] p-10 hover:border-accent-orange hover:shadow-2xl transition-all duration-500 text-left overflow-hidden h-full flex flex-col border border-transparent`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="mb-8 p-6 bg-accent-orange/10 rounded-3xl w-fit group-hover:scale-110 transition-transform duration-500">
                                <MessageSquare className="w-12 h-12 text-accent-orange" />
                            </div>

                            <h3 className="text-3xl font-bold mb-4 group-hover:text-accent-orange transition-colors">
                                Chat Features
                            </h3>
                            <p className={`${tc.textDim} text-lg mb-8 flex-grow leading-relaxed`}>
                                Engage with our advanced AI chat assistant. Brainstorm ideas, get answers, and collaborate in real-time.
                            </p>

                            <div className="flex items-center gap-3 text-accent-orange font-bold text-lg group-hover:gap-5 transition-all mt-auto">
                                Start Chatting
                                <ArrowRight className="w-6 h-6" />
                            </div>
                        </div>
                    </motion.button>

                    {/* AI Studio Card */}
                    <motion.button
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        onClick={handleAIStudio}
                        className={`group relative ${tc.card} rounded-[40px] p-10 hover:border-accent-orange hover:shadow-2xl transition-all duration-500 text-left overflow-hidden h-full flex flex-col border border-transparent`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-bl from-accent-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="mb-8 p-6 bg-accent-orange/10 rounded-3xl w-fit group-hover:scale-110 transition-transform duration-500">
                                <Wand2 className="w-12 h-12 text-accent-orange" />
                            </div>

                            <h3 className="text-3xl font-bold mb-4 group-hover:text-accent-orange transition-colors">
                                AI Studio
                            </h3>
                            <p className={`${tc.textDim} text-lg mb-8 flex-grow leading-relaxed`}>
                                Unleash your creativity with our powerful generation tools. Create images, videos, and more with AI.
                            </p>

                            <div className="flex items-center gap-3 text-accent-orange font-bold text-lg group-hover:gap-5 transition-all mt-auto">
                                Open Studio
                                <ArrowRight className="w-6 h-6" />
                            </div>
                        </div>
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

export default function WelcomePage() {
    return (
        <ThemeProvider>
            <WelcomePageContent />
        </ThemeProvider>
    );
}
