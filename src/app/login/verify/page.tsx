'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applyActionCode, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import NoiseOverlay from '@/components/shared/NoiseOverlay';

type VerificationState = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
    const [state, setState] = useState<VerificationState>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [resending, setResending] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const verifyEmail = async () => {
            const oobCode = searchParams.get('oobCode');

            if (!oobCode) {
                setState('error');
                setErrorMessage('Invalid verification link. No code provided.');
                return;
            }

            try {
                // Apply the email verification code
                await applyActionCode(auth, oobCode);
                setState('success');
                
                // Reload user to update emailVerified status
                if (auth.currentUser) {
                    await auth.currentUser.reload();
                }
            } catch (error: any) {
                console.error('Email verification error:', error);
                setState('error');
                
                if (error.code === 'auth/invalid-action-code') {
                    setErrorMessage('This verification link has expired or already been used.');
                } else if (error.code === 'auth/expired-action-code') {
                    setErrorMessage('This verification link has expired.');
                } else {
                    setErrorMessage('Failed to verify email. Please try again.');
                }
            }
        };

        verifyEmail();
    }, [searchParams]);

    const handleResendVerification = async () => {
        if (!auth.currentUser) {
            router.push('/login');
            return;
        }

        setResending(true);
        try {
            await sendEmailVerification(auth.currentUser);
            setErrorMessage('Verification email sent! Check your inbox.');
        } catch (error: any) {
            console.error('Resend verification error:', error);
            if (error.code === 'auth/too-many-requests') {
                setErrorMessage('Too many requests. Please try again later.');
            } else {
                setErrorMessage('Failed to send verification email. Please try again.');
            }
        } finally {
            setResending(false);
        }
    };

    const handleContinue = () => {
        router.push('/billing');
    };

    return (
        <main className="min-h-screen w-full flex items-center justify-center p-4 bg-black relative overflow-hidden">
            <NoiseOverlay />

            {/* Background Decorative Gradients */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent-orange/20 rounded-full blur-[150px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-orange/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Content */}
            <div className="relative z-10 w-full flex justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-md"
                >
                    <div className="glass-card p-10 rounded-[40px] shadow-premium border border-text-main/10">
                        <div className="text-center mb-10">
                            <Link href="/" className="inline-block mb-6 group">
                                <Image
                                    src="/OKVEVO Logos WithOut BackGrounds/Orange.svg"
                                    alt="OKVEVO"
                                    width={225}
                                    height={75}
                                    className="h-12 w-auto object-contain group-hover:scale-105 transition-transform"
                                />
                            </Link>
                        </div>

                        {/* Loading State */}
                        {state === 'loading' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-12"
                            >
                                <div className="flex justify-center mb-6">
                                    <div className="relative">
                                        <Loader2 className="w-16 h-16 text-accent-orange animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Mail className="w-8 h-8 text-white" />
                                        </div>
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-3">
                                    Verifying your email…
                                </h2>
                                <p className="text-text-dim">
                                    Please wait while we confirm your email address
                                </p>
                            </motion.div>
                        )}

                        {/* Success State */}
                        {state === 'success' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="text-center py-12"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="flex justify-center mb-6"
                                >
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl" />
                                        <CheckCircle2 className="w-20 h-20 text-green-500 relative" strokeWidth={2} />
                                    </div>
                                </motion.div>
                                <h2 className="text-3xl font-bold text-white mb-3">
                                    Your email is verified 🎉
                                </h2>
                                <p className="text-text-dim mb-8">
                                    You're all set! Start creating amazing content.
                                </p>
                                <button
                                    onClick={handleContinue}
                                    className="w-full bg-accent-orange hover:bg-text-main text-white font-bold py-4 rounded-2xl transition-all duration-500 transform hover:scale-[1.02] hover:shadow-2xl flex items-center justify-center gap-2"
                                >
                                    Continue to Dashboard
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </motion.div>
                        )}

                        {/* Error State */}
                        {state === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="text-center py-12"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="flex justify-center mb-6"
                                >
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl" />
                                        <XCircle className="w-20 h-20 text-red-500 relative" strokeWidth={2} />
                                    </div>
                                </motion.div>
                                <h2 className="text-3xl font-bold text-white mb-3">
                                    Verification Failed
                                </h2>
                                <p className="text-text-dim mb-8">
                                    {errorMessage || 'Invalid or expired link'}
                                </p>
                                
                                <div className="space-y-3">
                                    {auth.currentUser && !auth.currentUser.emailVerified && (
                                        <button
                                            onClick={handleResendVerification}
                                            disabled={resending}
                                            className="w-full bg-accent-orange hover:bg-text-main text-white font-bold py-4 rounded-2xl transition-all duration-500 transform hover:scale-[1.02] hover:shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {resending ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Mail className="w-5 h-5" />
                                                    Resend Verification Email
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <Link
                                        href="/login"
                                        className="block w-full bg-white hover:bg-gray-50 border-2 border-text-main/10 hover:border-accent-orange/30 text-black font-bold py-4 rounded-2xl transition-all duration-500 text-center"
                                    >
                                        Back to Login
                                    </Link>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </main>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen w-full flex items-center justify-center p-4 bg-black relative overflow-hidden">
                <NoiseOverlay />
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent-orange/20 rounded-full blur-[150px] animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-orange/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                <div className="relative z-10 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
                </div>
            </main>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
