"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../config/firebase';
import { joinProOrganisation, checkProMemberLimit, getProOrganisation } from '../../../../services/userService';
import { Users, ArrowLeft, Loader2, CheckCircle, AlertCircle, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeProvider, useTheme } from '../../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../../utils/themeUtils';
import NoiseOverlay from '../../../../components/NoiseOverlay';
import { motion } from 'framer-motion';

function JoinProOrganisationPageContent() {
    const router = useRouter();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [orgName, setOrgName] = useState('');

    // Form state
    const [organisationId, setOrganisationId] = useState('');
    const [validating, setValidating] = useState(false);
    const [orgInfo, setOrgInfo] = useState<{ name: string; currentCount: number; maxCount: number } | null>(null);

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

    const handleValidateOrgId = async () => {
        if (!organisationId.trim()) return;

        setValidating(true);
        setError('');
        setOrgInfo(null);

        try {
            const org = await getProOrganisation(organisationId.trim());
            if (!org) {
                setError('Organisation not found. Please check the ID and try again.');
                setValidating(false);
                return;
            }

            const limitCheck = await checkProMemberLimit(organisationId.trim());
            if (!limitCheck.canJoin) {
                setError('This Pro organisation has reached its maximum capacity (5 members).');
                setValidating(false);
                return;
            }

            setOrgInfo({
                name: org.name,
                currentCount: limitCheck.currentCount,
                maxCount: limitCheck.maxCount,
            });
        } catch (err: any) {
            console.error('Error validating organisation:', err);
            setError('Failed to validate organisation. Please try again.');
        } finally {
            setValidating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !orgInfo) return;

        setJoining(true);
        setError('');

        try {
            const joined = await joinProOrganisation(user.uid, user.email || '', organisationId.trim());

            if (joined) {
                setOrgName(orgInfo.name);
                setSuccess(true);
            } else {
                setError('Failed to join organisation. Please check the ID and try again.');
            }
        } catch (err: any) {
            console.error('Error joining Pro organisation:', err);
            if (err.message.includes('maximum capacity')) {
                setError('This Pro organisation has reached its maximum capacity (5 members).');
            } else {
                setError('Failed to join Pro organisation. Please try again.');
            }
        } finally {
            setJoining(false);
        }
    };

    const handleContinue = () => {
        router.push('/onboarding/intro');
    };

    if (loading) {
        return (
            <div className={`min-h-screen ${tc.bg} flex items-center justify-center`}>
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className={`min-h-screen ${tc.bg} ${tc.text} flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
                {resolvedTheme === 'light' && <NoiseOverlay />}

                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-orange/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 w-full max-w-2xl"
                >
                    <div className={`${tc.card} rounded-3xl p-10 text-center`}>
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-6">
                            <CheckCircle className="w-10 h-10 text-white" />
                        </div>

                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-accent-orange">
                            Successfully Joined!
                        </h1>
                        <p className={tc.textDim + " mb-8"}>
                            You are now a member of <span className="text-accent-orange font-bold">{orgName}</span> Pro organisation.
                        </p>

                        <button
                            onClick={handleContinue}
                            className="w-full bg-gradient-to-r from-accent-orange to-orange-600 hover:from-orange-600 hover:to-accent-orange text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                        >
                            Continue to Profile
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Form state
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
                    className={`p-3 ${tc.sidebar} rounded-2xl hover:scale-110 transition-all duration-300 shadow-lg`}
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
                        href="/onboarding/pro"
                        className={`inline-flex items-center gap-2 ${tc.textDim} hover:text-accent-orange transition-colors mb-8`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </Link>
                </motion.div>

                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-8"
                >
                    <Link href="/" className="inline-block mb-4">
                        <Image
                            src="/OKVEVO Logos WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={60}
                            height={60}
                            className="w-16 h-16 hover:scale-110 transition-transform"
                        />
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-bold mb-3 text-accent-orange">
                        Join Pro Organisation
                    </h1>
                    <p className={tc.textDim}>
                        Enter the organisation ID provided by your admin
                    </p>
                </motion.div>

                {/* Form */}
                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    onSubmit={handleSubmit}
                    className={`${tc.card} rounded-3xl p-8`}
                >
                    <div className="space-y-6">
                        {/* Organisation Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="p-6 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl shadow-lg">
                                <Users className="w-10 h-10 text-white" />
                            </div>
                        </div>

                        {/* Organisation ID */}
                        <div>
                            <label htmlFor="organisationId" className={`block text-sm font-medium ${tc.text} mb-2`}>
                                Organisation ID *
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    id="organisationId"
                                    value={organisationId}
                                    onChange={(e) => {
                                        setOrganisationId(e.target.value);
                                        setOrgInfo(null);
                                        setError('');
                                    }}
                                    placeholder="pro_1234567890_abcdefghi"
                                    className={`flex-1 ${tc.input} px-4 py-3.5 rounded-xl font-mono text-sm`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={handleValidateOrgId}
                                    disabled={validating || !organisationId.trim()}
                                    className="px-6 bg-accent-orange/20 hover:bg-accent-orange/30 border border-accent-orange/40 text-accent-orange font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {validating ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'Validate'
                                    )}
                                </button>
                            </div>
                            <p className={`text-xs ${tc.textDim} mt-2`}>
                                Ask your admin for the organisation ID
                            </p>
                        </div>

                        {/* Organisation Info */}
                        {orgInfo && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-green-400 font-medium mb-1">Organisation Found!</p>
                                        <p className={`${tc.text} text-sm`}>
                                            <strong>{orgInfo.name}</strong>
                                        </p>
                                        <p className={`${tc.textDim} text-xs mt-1`}>
                                            Members: {orgInfo.currentCount}/{orgInfo.maxCount}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={joining || !orgInfo}
                            className="w-full bg-gradient-to-r from-accent-orange to-orange-600 hover:from-orange-600 hover:to-accent-orange text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {joining ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                <>
                                    <Users className="w-5 h-5" />
                                    Join Pro Organisation
                                </>
                            )}
                        </button>

                        {!orgInfo && (
                            <p className={`text-xs ${tc.textDim} text-center`}>
                                Please validate the organisation ID before joining
                            </p>
                        )}
                    </div>
                </motion.form>
            </div>
        </div>
    );
}

export default function JoinProOrganisationPage() {
    return (
        <ThemeProvider>
            <JoinProOrganisationPageContent />
        </ThemeProvider>
    );
}
