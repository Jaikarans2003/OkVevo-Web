"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function AuthForm() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let userCredential;
            if (isLogin) {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            } else {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            }

            // Create user profile in Firestore for new users
            if (!isLogin) {
                const { createUserProfile } = await import('../services/userService');
                await createUserProfile(userCredential.user.uid, userCredential.user.email || '');
            }

            // Check if user has completed onboarding
            const { getUserProfile } = await import('../services/userService');
            const userProfile = await getUserProfile(userCredential.user.uid);

            if (userProfile?.onboardingComplete) {
                // Check if user should see Pro prompt
                if (!userProfile?.proPromptShown && !userProfile?.isPro) {
                    router.push('/pro-prompt');
                } else {
                    router.push('/profile');
                }
            } else {
                router.push('/onboarding');
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Email is already in use.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password should be at least 6 characters.');
            } else {
                setError('An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await signInWithPopup(auth, googleProvider);

            // Create user profile if it doesn't exist
            const { createUserProfile, getUserProfile } = await import('../services/userService');
            await createUserProfile(result.user.uid, result.user.email || '');

            // Check if user has completed onboarding
            const userProfile = await getUserProfile(result.user.uid);

            if (userProfile?.onboardingComplete) {
                // Check if user should see Pro prompt
                if (!userProfile?.proPromptShown && !userProfile?.isPro) {
                    router.push('/pro-prompt');
                } else {
                    router.push('/profile');
                }
            } else {
                router.push('/onboarding');
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Sign in was cancelled.');
            } else {
                setError('Google sign in failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
        >
            <div className="glass-card p-10 rounded-[40px] shadow-premium border border-text-main/10">
                <div className="text-center mb-10">
                    <Link href="/" className="inline-block mb-6 group">
                        <span className="text-4xl font-black tracking-tighter text-text-main group-hover:text-accent-orange transition-colors">
                            OKVEVO<span className="text-accent-orange">.</span>
                        </span>
                    </Link>
                    <h2 className="text-3xl font-bold text-text-main mb-3 tracking-tight">
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p className="text-text-dim text-base">
                        {isLogin ? 'Enter your details to access your workspace' : 'Start your creative journey today'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-4">
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-dim/50 group-focus-within:text-accent-orange transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                className="w-full bg-white border-2 border-text-main/10 rounded-2xl px-12 py-4 text-text-main placeholder:text-text-dim/40 focus:outline-none focus:border-accent-orange focus:ring-0 transition-all font-medium"
                                required
                            />
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-dim/50 group-focus-within:text-accent-orange transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="w-full bg-white border-2 border-text-main/10 rounded-2xl px-12 py-4 text-text-main placeholder:text-text-dim/40 focus:outline-none focus:border-accent-orange focus:ring-0 transition-all font-medium"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-600 text-sm text-center font-medium"
                        >
                            {error}
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-accent-orange hover:bg-text-main text-white font-bold py-4 rounded-2xl transition-all duration-500 transform hover:scale-[1.02] hover:shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                {isLogin ? 'Sign In' : 'Create Account'}
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>

                <div className="my-8 flex items-center gap-4">
                    <div className="h-px bg-text-main/10 flex-1" />
                    <span className="text-text-dim/60 text-xs font-bold tracking-widest uppercase">OR CONTINUE WITH</span>
                    <div className="h-px bg-text-main/10 flex-1" />
                </div>

                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-white hover:bg-text-main/5 border-2 border-text-main/10 hover:border-accent-orange/30 text-text-main font-bold py-4 rounded-2xl transition-all duration-500 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                        <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="#FBBC04"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Continue with Google
                </button>

                <div className="mt-8 text-center">
                    <p className="text-text-dim">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                            className="ml-2 text-accent-orange hover:text-text-main font-bold hover:underline transition-all"
                        >
                            {isLogin ? 'Sign up' : 'Log in'}
                        </button>
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
