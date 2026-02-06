"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, ArrowLeft, ArrowRight, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeProvider, useTheme } from '../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../utils/themeUtils';
import NoiseOverlay from '../../../components/NoiseOverlay';
import { motion } from 'framer-motion';

function ProOnboardingPageContent() {
    const router = useRouter();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);
    const [selecting, setSelecting] = useState(false);

    const handleCreatePro = () => {
        router.push('/onboarding/pro/create');
    };

    const handleJoinPro = () => {
        router.push('/onboarding/pro/join');
    };

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

            <div className="relative z-10 w-full max-w-4xl">
                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Link
                        href="/onboarding"
                        className={`inline-flex items-center gap-2 ${tc.textDim} hover:text-accent-orange transition-colors mb-8`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to options
                    </Link>
                </motion.div>

                {/* Logo & Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <Link href="/" className="inline-block mb-6">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={80}
                            height={80}
                            className="w-20 h-20 hover:scale-110 transition-transform"
                        />
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-accent-orange">
                        OKVEVO Pro
                    </h1>
                    <p className={`text-xl ${tc.textDim}`}>
                        Create or join a Pro organization (max 5 members)
                    </p>
                </motion.div>

                {/* Options Cards */}
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Create Pro Organisation Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        onClick={handleCreatePro}
                        disabled={selecting}
                        className={`group relative ${tc.card} rounded-3xl p-8 hover:border-accent-orange hover:scale-105 hover:-translate-y-2 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                    >
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Building2 className="w-12 h-12 text-white" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                    Create Pro Organisation
                                </h3>
                                <p className={`${tc.textDim} leading-relaxed mb-4`}>
                                    Start your own Pro organization and invite up to 4 team members to join you.
                                </p>
                                <ul className={`text-sm ${tc.textDim} space-y-2 text-left`}>
                                    <li>• You'll be the admin</li>
                                    <li>• Invite up to 4 members</li>
                                    <li>• Full control over team</li>
                                    <li>• Works with any email</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                Create New Pro Org
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </motion.button>

                    {/* Join Pro Organisation Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        onClick={handleJoinPro}
                        disabled={selecting}
                        className={`group relative ${tc.card} rounded-3xl p-8 hover:border-accent-orange hover:scale-105 hover:-translate-y-2 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                    >
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-orange-600 to-accent-orange rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Users className="w-12 h-12 text-white" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                    Join Pro Organisation
                                </h3>
                                <p className={`${tc.textDim} leading-relaxed mb-4`}>
                                    Join an existing Pro organization using an organization ID provided by your admin.
                                </p>
                                <ul className={`text-sm ${tc.textDim} space-y-2 text-left`}>
                                    <li>• Need organization ID</li>
                                    <li>• Join existing team</li>
                                    <li>• Collaborate instantly</li>
                                    <li>• Subject to 5-member limit</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                Join Existing Pro Org
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </motion.button>
                </div>

                {/* Info Note */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className={`mt-8 text-center text-sm ${tc.textDim}`}
                >
                    Pro organizations are limited to 5 members maximum
                </motion.div>
            </div>
        </div>
    );
}

export default function ProOnboardingPage() {
    return (
        <ThemeProvider>
            <ProOnboardingPageContent />
        </ThemeProvider>
    );
}
