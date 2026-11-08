"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    type User,
} from 'firebase/auth';
import { auth, googleProvider } from '@/config/firebase';
import {
    desktopCallbackUrl,
    isAllowlistedDesktopRedirect,
    isUsableDesktopState,
} from '@/lib/auth/desktop-redirect';
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AuthForm({
    desktopRedirect,
    desktopState,
}: {
    desktopRedirect?: string;
    desktopState?: string;
} = {}) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const [returning, setReturning] = useState(false);
    const bouncing = useRef(false);
    const router = useRouter();
    const isDesktopRoundTrip =
        isAllowlistedDesktopRedirect(desktopRedirect) && isUsableDesktopState(desktopState);

    const bounceToDesktop = async (user: User) => {
        if (!desktopRedirect || !desktopState || bouncing.current) return;
        bouncing.current = true;
        setReturning(true);
        setError('');
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/auth/desktop/mint', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ redirect: desktopRedirect, state: desktopState }),
            });
            const data = (await res.json()) as { code?: string; error?: string };
            if (!res.ok || !data.code) {
                throw new Error(data.error || 'mint_failed');
            }
            window.location.assign(desktopCallbackUrl(desktopRedirect, data.code, desktopState));
        } catch (err) {
            console.error(err);
            bouncing.current = false;
            setReturning(false);
            setError('Could not return to Nia. Try signing in again.');
        }
    };

    useEffect(() => {
        if (isDesktopRoundTrip) {
            return onAuthStateChanged(auth, (user) => {
                if (user) void bounceToDesktop(user);
            });
        }
        // First callback is the restored Firebase session. Later sign-ins on this
        // form go through handleSubmit / Google.
        let initial = true;
        return onAuthStateChanged(auth, (user) => {
            if (!initial) return;
            initial = false;
            if (user) router.replace('/billing');
        });
        // bounceToDesktop closes over the allowlisted redirect + state for this mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDesktopRoundTrip, desktopRedirect, desktopState, router]);

    // A pricing-page plan click sent them here to sign in: take them back to it.
    const goAfterSignIn = () => {
        if (sessionStorage.getItem('returnToPlan')) {
            sessionStorage.removeItem('returnToPlan');
            router.push('/pricing');
            return;
        }
        router.push('/billing');
    };

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
                const { createUserProfile } = await import('@/services/userService');
                await createUserProfile(userCredential.user.uid, userCredential.user.email || '');
            }

            if (isDesktopRoundTrip) {
                await bounceToDesktop(userCredential.user);
                return;
            }

            goAfterSignIn();
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
            const { createUserProfile } = await import('@/services/userService');
            await createUserProfile(result.user.uid, result.user.email || '');

            if (isDesktopRoundTrip) {
                await bounceToDesktop(result.user);
                return;
            }

            goAfterSignIn();
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

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Please enter your email address first.');
            return;
        }
        
        setLoading(true);
        setError('');
        setResetEmailSent(false);
        
        try {
            await sendPasswordResetEmail(auth, email);
            setResetEmailSent(true);
            setError('');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/user-not-found') {
                setError('No account found with this email.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address.');
            } else {
                setError('Failed to send reset email. Please try again.');
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
            className="pt-card"
        >
            {returning ? (
                <div className="pt-status" role="status">
                    <span className="pt-badge"><Loader2 className="w-7 h-7 animate-spin" aria-hidden /></span>
                    <h2>Returning to Nia…</h2>
                    <p className="sub">You can close this tab once the app opens.</p>
                </div>
            ) : (
            <>
                <div>
                    <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
                    <p className="sub" style={{ marginTop: 12 }}>
                        {isLogin ? 'Sign in to manage your plan, credits and profile.' : 'One account for the OkVevo portal and the Nia app.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="pt-field">
                        <label htmlFor="auth-email">Email</label>
                        <div className="pt-input-icon">
                            <Mail size={18} aria-hidden />
                            <input
                                id="auth-email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@business.com"
                                className="pt-input"
                                required
                            />
                        </div>
                    </div>
                    <div className="pt-field">
                        <label htmlFor="auth-password">Password</label>
                        <div className="pt-input-icon">
                            <Lock size={18} aria-hidden />
                            <input
                                id="auth-password"
                                type="password"
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                className="pt-input"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    {isLogin && (
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={loading}
                            className="pt-textbtn pt-forgot"
                        >
                            Forgot password?
                        </button>
                    )}

                    {resetEmailSent && (
                        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="pt-note pt-note--good" role="status">
                            <CheckCircle2 size={18} aria-hidden />
                            Password reset email sent. Check your inbox.
                        </motion.p>
                    )}

                    {error && (
                        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="pt-note pt-note--bad" role="alert">
                            <AlertCircle size={18} aria-hidden />
                            {error}
                        </motion.p>
                    )}

                    <button type="submit" disabled={loading} className="btn btn--go">
                        {loading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" aria-hidden /><span className="sr-only">Working…</span></>
                        ) : (
                            <>
                                {isLogin ? 'Sign in' : 'Create account'}
                                <ArrowRight className="w-5 h-5" style={{ marginLeft: 8 }} aria-hidden />
                            </>
                        )}
                    </button>
                </form>

                <p className="pt-or">or</p>

                <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                <p className="pt-switch">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                        className="pt-textbtn"
                    >
                        {isLogin ? 'Sign up' : 'Log in'}
                    </button>
                </p>
            </>
            )}
        </motion.div>
    );
}
