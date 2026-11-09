'use client';

import { useEffect, useState, Suspense, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applyActionCode, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';
import PortalShell from '@/components/portal/PortalShell';
import DrawnArt from '@/components/landing-page/DrawnArt';
import LoadingScreen from '@/components/shared/LoadingScreen';

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
        <PortalShell signedIn={false}>
            <section className="pt-auth">
                <div className="pt-auth-art sheet sheet--sand">
                    <DrawnArt name="login" layers={7} width={1100} height={917} float={[6]}
                        alt="An open door with warm light spilling onto the mat, a key floating beside it" />
                </div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="pt-card"
                >
                    {state === 'loading' && (
                        <div className="pt-status" role="status">
                            <span className="pt-badge"><Loader2 className="w-8 h-8 animate-spin" aria-hidden /></span>
                            <h1>Verifying your email…</h1>
                            <p className="sub">Please wait while we confirm your email address.</p>
                        </div>
                    )}

                    {state === 'success' && (
                        <div className="pt-status" style={{ '--spot': 'var(--olive)' } as CSSProperties}>
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                className="pt-badge"
                            >
                                <CheckCircle2 className="w-9 h-9" aria-hidden />
                            </motion.span>
                            <h1>Your email is verified</h1>
                            <p className="sub">You&apos;re all set.</p>
                            <button type="button" onClick={handleContinue} className="btn btn--go">
                                Continue to billing
                                <ArrowRight className="w-5 h-5" style={{ marginLeft: 8 }} aria-hidden />
                            </button>
                        </div>
                    )}

                    {state === 'error' && (
                        <div className="pt-status" style={{ '--spot': 'var(--rust)' } as CSSProperties}>
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                className="pt-badge"
                            >
                                <XCircle className="w-9 h-9" aria-hidden />
                            </motion.span>
                            <h1>Verification failed</h1>
                            <p className="sub" role="alert">{errorMessage || 'Invalid or expired link'}</p>
                            {auth.currentUser && !auth.currentUser.emailVerified && (
                                <button type="button" onClick={handleResendVerification} disabled={resending} className="btn btn--go">
                                    {resending ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" style={{ marginRight: 8 }} aria-hidden />Sending…</>
                                    ) : (
                                        <><Mail className="w-5 h-5" style={{ marginRight: 8 }} aria-hidden />Resend verification email</>
                                    )}
                                </button>
                            )}
                            <Link href="/login" className="btn">Back to login</Link>
                        </div>
                    )}
                </motion.div>
            </section>
        </PortalShell>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <VerifyEmailContent />
        </Suspense>
    );
}
