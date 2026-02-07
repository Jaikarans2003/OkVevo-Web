"use client";

import { useRouter } from 'next/navigation';
import { Sparkles, User, Megaphone, ArrowRight } from 'lucide-react';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import NoiseOverlay from '../../components/NoiseOverlay';
import FloatingSidebar from '../../components/chat/FloatingSidebar';
import { motion } from 'framer-motion';

function StudioPageContent() {
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const handleNewChat = () => {
        router.push('/chat');
    };

    const handleAvatarCreation = () => {
        // Placeholder or navigation to avatar creation tool
        // router.push('/studio/avatar'); 
        alert("Avatar Creation coming soon!");
    };

    const handleAdsCreation = () => {
        // Placeholder or navigation to ads creation tool
        // router.push('/studio/ads');
        alert("Ads Creation coming soon!");
    };

    return (
        <div className={`min-h-screen ${tc.bg} ${tc.text} flex flex-col relative overflow-hidden`}>
            {resolvedTheme === 'light' && <NoiseOverlay />}

            {/* Floating Sidebar */}
            <FloatingSidebar resetConversation={handleNewChat} />

            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-orange/10 rounded-full blur-[100px] opacity-50" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] opacity-30" />
            </div>

            <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 pl-24">
                <div className="max-w-4xl w-full">

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <div className="inline-flex items-center gap-3 bg-accent-orange/10 px-6 py-2 rounded-full mb-6 border border-accent-orange/20">
                            <Sparkles className="w-5 h-5 text-accent-orange" />
                            <span className="text-accent-orange font-bold tracking-wide uppercase text-sm">Creative Suite</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
                            AI <span className="text-accent-orange">Studio</span>
                        </h1>
                        <p className={`text-xl ${tc.textDim} max-w-2xl mx-auto leading-relaxed`}>
                            Select a tool to start creating amazing content.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Avatar Creation Card */}
                        <motion.button
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            onClick={handleAvatarCreation}
                            className={`group relative ${tc.card} p-10 rounded-[40px] border border-white/5 hover:border-accent-orange/30 text-left transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 overflow-hidden`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-16 h-16 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg group-hover:scale-110 transition-transform duration-500">
                                    <User className="w-8 h-8 text-white" />
                                </div>

                                <h3 className="text-3xl font-bold mb-4 group-hover:text-accent-orange transition-colors">
                                    Avatar Creation
                                </h3>

                                <p className={`${tc.textDim} text-lg mb-8 leading-relaxed`}>
                                    Design and customize unique digital avatars for your brand or personal identity.
                                </p>

                                <div className="mt-auto flex items-center gap-3 text-accent-orange font-bold group-hover:gap-5 transition-all">
                                    Create Avatar <ArrowRight className="w-5 h-5" />
                                </div>
                            </div>
                        </motion.button>

                        {/* Ads Creation Card */}
                        <motion.button
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            onClick={handleAdsCreation}
                            className={`group relative ${tc.card} p-10 rounded-[40px] border border-white/5 hover:border-blue-500/30 text-left transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 overflow-hidden`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg group-hover:scale-110 transition-transform duration-500">
                                    <Megaphone className="w-8 h-8 text-white" />
                                </div>

                                <h3 className="text-3xl font-bold mb-4 group-hover:text-blue-500 transition-colors">
                                    Ads Creation
                                </h3>

                                <p className={`${tc.textDim} text-lg mb-8 leading-relaxed`}>
                                    Generate high-converting video ads and marketing assets in seconds.
                                </p>

                                <div className="mt-auto flex items-center gap-3 text-blue-500 font-bold group-hover:gap-5 transition-all">
                                    Create Ad <ArrowRight className="w-5 h-5" />
                                </div>
                            </div>
                        </motion.button>
                    </div>

                </div>
            </main>
        </div>
    );
}

export default function StudioPage() {
    return (
        <ThemeProvider>
            <StudioPageContent />
        </ThemeProvider>
    );
}
