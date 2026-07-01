"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import { isCustomDomain } from '../../../services/userService';
import { UserPlus, Building, ArrowLeft, ArrowRight, Loader2, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeProvider, useTheme } from '../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../utils/themeUtils';
import NoiseOverlay from '../../../components/NoiseOverlay';
import { motion } from 'framer-motion';

function OrganisationOptionsPageContent() {
    const router = useRouter();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
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
                        Back to User Type Selection
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
                            src="/OKVEVO Logos WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={80}
                            height={80}
                            className="w-20 h-20 hover:scale-110 transition-transform"
                        />
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-accent-orange">
                        Organisation Setup
                    </h1>
                    <p className={`text-xl ${tc.textDim}`}>
                        Choose how you'd like to proceed
                    </p>
                    {user?.email && (
                        <p className={`text-sm ${tc.textDim} mt-2 opacity-70`}>
                            Logged in as: {user.email}
                        </p>
                    )}
                </motion.div>

                {/* Organisation Options Cards */}
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Join Organisation Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        <Link
                            href="/onboarding/organisation/join"
                            className={`group relative ${tc.card} rounded-3xl p-8 hover:border-accent-orange hover:scale-105 hover:-translate-y-2 transition-all duration-500 text-left block`}
                        >
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className="p-6 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                    <UserPlus className="w-12 h-12 text-white" />
                                </div>

                                <div>
                                    <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                        Join an Existing Organisation
                                    </h3>
                                    <p className={`${tc.textDim} leading-relaxed mb-4`}>
                                        Enter an organisation code to join your team's workspace.
                                    </p>
                                    <ul className={`text-sm ${tc.textDim} space-y-2 text-left`}>
                                        <li>• Quick setup with organisation code</li>
                                        <li>• Access shared projects</li>
                                        <li>• Collaborate with team members</li>
                                    </ul>
                                </div>

                                <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                    Join Organisation
                                    <ArrowRight className="w-5 h-5" />
                                </div>
                            </div>
                        </Link>
                    </motion.div>

                    {/* Form Organisation Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="relative"
                    >
                        {canFormOrganisation ? (
                            <Link
                                href="/onboarding/organisation/form"
                                className={`group relative ${tc.card} rounded-3xl p-8 hover:border-accent-orange hover:scale-105 hover:-translate-y-2 transition-all duration-500 text-left block`}
                            >
                                <div className="flex flex-col items-center text-center space-y-6">
                                    <div className="p-6 bg-gradient-to-br from-orange-600 to-accent-orange rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                        <Building className="w-12 h-12 text-white" />
                                    </div>

                                    <div>
                                        <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                            Form an Organisation
                                        </h3>
                                        <p className={`${tc.textDim} leading-relaxed mb-4`}>
                                            Create a new organisation and become the admin.
                                        </p>
                                        <ul className={`text-sm ${tc.textDim} space-y-2 text-left`}>
                                            <li>• Full admin control</li>
                                            <li>• Invite team members</li>
                                            <li>• Manage organisation settings</li>
                                        </ul>
                                    </div>

                                    <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                        Create Organisation
                                        <ArrowRight className="w-5 h-5" />
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            <div className={`relative ${tc.card} rounded-3xl p-8 opacity-60 cursor-not-allowed text-left border-2 ${resolvedTheme === 'light' ? 'border-text-main/10' : 'border-accent-orange/20'}`}>
                                <div className="absolute top-4 right-4 bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full border border-red-500/50">
                                    Custom Domain Required
                                </div>

                                <div className="flex flex-col items-center text-center space-y-6">
                                    <div className="p-6 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl shadow-lg">
                                        <Building className="w-12 h-12 text-white" />
                                    </div>

                                    <div>
                                        <h3 className={`text-2xl font-bold mb-3 ${tc.textDim} opacity-70`}>
                                            Form an Organisation
                                        </h3>
                                        <p className={`${tc.textDim} opacity-70 leading-relaxed mb-4`}>
                                            To create an organisation, you need to sign in with a custom domain email (not Gmail, Yahoo, etc.).
                                        </p>
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-4">
                                            <p className="text-sm text-red-400">
                                                Your current email ({user?.email}) uses a common email provider. Please sign in with your organisation's email address to create an organisation.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

export default function OrganisationOptionsPage() {
    return (
        <ThemeProvider>
            <OrganisationOptionsPageContent />
        </ThemeProvider>
    );
}
