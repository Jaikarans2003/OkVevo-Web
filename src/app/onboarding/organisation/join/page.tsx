"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../config/firebase';
import { joinOrganisation, getOrganisation } from '../../../../services/userService';
import { ArrowLeft, Building2, Loader2, CheckCircle, AlertCircle, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeProvider, useTheme } from '../../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../../utils/themeUtils';
import NoiseOverlay from '../../../../components/NoiseOverlay';
import { motion } from 'framer-motion';

function JoinOrganisationPageContent() {
    const router = useRouter();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [organisationId, setOrganisationId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

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

    const handleJoinOrganisation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !organisationId.trim()) return;

        setJoining(true);
        setError('');

        try {
            // First, check if organisation exists
            const org = await getOrganisation(organisationId.trim());
            if (!org) {
                setError('Organisation not found. Please check the organisation ID and try again.');
                setJoining(false);
                return;
            }

            // Join the organisation
            const result = await joinOrganisation(user.uid, user.email, organisationId.trim());

            if (result) {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/onboarding/intro');
                }, 2000);
            } else {
                setError('Failed to join organisation. Please try again.');
            }
        } catch (err: any) {
            console.error('Error joining organisation:', err);
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setJoining(false);
        }
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

            <div className="relative z-10 w-full max-w-2xl">
                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Link
                        href="/onboarding/organisation"
                        className={`inline-flex items-center gap-2 ${tc.textDim} hover:text-accent-orange transition-colors mb-8`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Organisation Options
                    </Link>
                </motion.div>

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className={`${tc.card} rounded-3xl p-8 md:p-12 shadow-2xl relative`}
                >
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-block mb-6">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                width={60}
                                height={60}
                                className="w-15 h-15 hover:scale-110 transition-transform"
                            />
                        </Link>
                        <div className="inline-block p-4 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl mb-6">
                            <Building2 className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-accent-orange">
                            Join an Organisation
                        </h1>
                        <p className={tc.textDim}>
                            Enter the organisation ID provided by your admin
                        </p>
                    </div>

                    {success ? (
                        <div className="text-center py-8">
                            <div className="inline-block p-4 bg-green-500/20 rounded-full mb-4">
                                <CheckCircle className="w-12 h-12 text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-green-400 mb-2">
                                Successfully Joined!
                            </h3>
                            <p className={tc.textDim}>
                                Redirecting you to your profile...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleJoinOrganisation} className="space-y-6">
                            <div>
                                <label className={`block ${tc.text} font-semibold mb-3`}>
                                    Organisation ID
                                </label>
                                <input
                                    type="text"
                                    value={organisationId}
                                    onChange={(e) => setOrganisationId(e.target.value)}
                                    placeholder="e.g., org_1234567890_abc123"
                                    className={`w-full ${tc.input} px-4 py-3.5 rounded-xl font-medium`}
                                    required
                                    disabled={joining}
                                />
                                <p className={`text-sm ${tc.textDim} mt-2`}>
                                    Ask your organisation admin for the organisation ID
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={joining || !organisationId.trim()}
                                className="w-full bg-accent-orange hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {joining ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Joining Organisation...
                                    </>
                                ) : (
                                    'Join Organisation'
                                )}
                            </button>
                        </form>
                    )}

                    {/* Info Box */}
                    <div className={`mt-8 p-4 ${resolvedTheme === 'light' ? 'bg-accent-orange/10 border-2 border-accent-orange/30' : 'bg-accent-orange/10 border border-accent-orange/30'} rounded-xl`}>
                        <h4 className="text-sm font-bold text-accent-orange mb-2">
                            What happens next?
                        </h4>
                        <ul className={`text-sm ${tc.textDim} space-y-1`}>
                            <li>• You'll be added to the organisation's workspace</li>
                            <li>• Access shared projects and resources</li>
                            <li>• Collaborate with team members</li>
                        </ul>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default function JoinOrganisationPage() {
    return (
        <ThemeProvider>
            <JoinOrganisationPageContent />
        </ThemeProvider>
    );
}
