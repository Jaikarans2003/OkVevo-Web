"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { updateUserType, isCustomDomain } from '../../services/userService';
import { Users, Building2, ArrowRight, Loader2, Crown, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import NoiseOverlay from '../../components/NoiseOverlay';
import { motion } from 'framer-motion';

function OnboardingPageContent() {
    const router = useRouter();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState(false);
    const [canFormOrganisation, setCanFormOrganisation] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push('/login');
            } else {
                setUser(currentUser);
                setCanFormOrganisation(isCustomDomain(currentUser.email || ''));
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleSingleUser = async () => {
        if (!user) return;

        setSelecting(true);
        try {
            await updateUserType(user.uid, 'single');
            router.push('/profile');
        } catch (error) {
            console.error('Error updating user type:', error);
            alert('Failed to update user type. Please try again.');
        } finally {
            setSelecting(false);
        }
    };

    const handleOrganisation = () => {
        router.push('/onboarding/organisation');
    };

    const handlePro = () => {
        router.push('/onboarding/pro');
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
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {theme === 'light' ? 'Dark' : theme === 'dark' ? 'System' : 'Light'}
                    </span>
                </button>
            </div>

            <div className="relative z-10 w-full max-w-6xl">
                {/* Logo & Welcome */}
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
                        Welcome
                    </h1>
                    <p className={`text-xl ${tc.textDim}`}>
                        Let's get you set up.
                    </p>
                </motion.div>

                {/* User Type Selection Cards */}
                <div className="grid md:grid-cols-3 gap-7">
                    {/* Single User Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        onClick={handleSingleUser}
                        disabled={selecting}
                        className={`group relative ${tc.card} rounded-3xl p-8 hover:border-accent-orange hover:scale-105 hover:-translate-y-2 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                    >
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Users className="w-12 h-12 text-white" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                    Single User
                                </h3>
                                <p className={`${tc.textDim} leading-relaxed mb-4`}>
                                    Perfect for individual creators, freelancers, and solo content makers.
                                </p>
                                <ul className={`text-sm ${tc.textDim} space-y-2 text-left`}>
                                    <li>• Personal workspace</li>
                                    <li>• Individual project management</li>
                                    <li>• Full creative control</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                Continue as Single User
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </motion.button>

                    {/* Organisation Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        onClick={handleOrganisation}
                        disabled={selecting}
                        className={`group relative ${tc.card} rounded-3xl p-8 hover:border-accent-orange hover:scale-105 hover:-translate-y-2 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                    >
                        {!canFormOrganisation && (
                            <div className="absolute top-4 right-4 bg-orange-500/20 text-accent-orange text-xs font-bold px-3 py-1 rounded-full border border-accent-orange/50">
                                Join Only
                            </div>
                        )}

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-orange-600 to-accent-orange rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Building2 className="w-12 h-12 text-white" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                    Organisation
                                </h3>
                                <p className={`${tc.textDim} leading-relaxed mb-4`}>
                                    Collaborate with your team, manage projects together, and scale your content creation.
                                </p>
                                <ul className={`text-sm ${tc.textDim} space-y-2 text-left`}>
                                    <li>• Team collaboration</li>
                                    <li>• Shared workspace</li>
                                    <li>• Admin dashboard</li>
                                    {!canFormOrganisation && (
                                        <li className="text-orange-400">• Custom domain required to form</li>
                                    )}
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                Continue as Organisation
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </motion.button>

                    {/* Pro Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        onClick={handlePro}
                        disabled={selecting}
                        className={`group relative ${tc.card} rounded-3xl p-8 hover:border-accent-orange hover:scale-105 hover:-translate-y-2 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                    >
                        <div className="absolute top-4 right-4 bg-gradient-to-r from-accent-orange to-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                            Pro
                        </div>

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Crown className="w-12 h-12 text-white" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                    Pro (5 Seats)
                                </h3>
                                <p className={`${tc.textDim} leading-relaxed mb-4`}>
                                    Small team collaboration with up to 5 members. All features included.
                                </p>
                                <ul className={`text-sm ${tc.textDim} space-y-2 text-left`}>
                                    <li>• Up to 5 team members</li>
                                    <li>• All functionalities</li>
                                    <li>• Works with any email</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                Continue as Pro
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </motion.button>
                </div>

                {/* Info Note */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className={`mt-8 text-center text-sm ${tc.textDim}`}
                >
                    You can change this later in your profile settings
                </motion.div>
            </div>

            {selecting && (
                <div className={`fixed inset-0 ${tc.bg}/80 backdrop-blur-sm flex items-center justify-center z-50`}>
                    <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
                </div>
            )}
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <ThemeProvider>
            <OnboardingPageContent />
        </ThemeProvider>
    );
}
