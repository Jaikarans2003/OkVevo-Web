"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { markProPromptShown } from '../../services/userService';
import { Crown, Users, Sparkles, ArrowRight, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProPromptPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

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

    const handleUpgradeToPro = () => {
        router.push('/onboarding/pro');
    };

    const handleSkip = async () => {
        if (!user) return;

        setProcessing(true);
        try {
            await markProPromptShown(user.uid);
            router.push('/profile');
        } catch (error) {
            console.error('Error marking Pro prompt as shown:', error);
            router.push('/profile');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-custom-bg flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-custom-orange animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-custom-bg text-custom-cream flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-custom-orange/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 w-full max-w-3xl">
                {/* Skip Button */}
                <button
                    onClick={handleSkip}
                    disabled={processing}
                    className="absolute top-0 right-0 p-2 text-custom-cream/60 hover:text-custom-cream transition-colors disabled:opacity-50"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block mb-6">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={60}
                            height={60}
                            className="w-16 h-16 hover:scale-110 transition-transform"
                        />
                    </Link>
                </div>

                {/* Pro Badge */}
                <div className="flex justify-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-custom-orange to-orange-600 px-6 py-2 rounded-full">
                        <Crown className="w-5 h-5 text-custom-cream" />
                        <span className="text-custom-cream font-bold text-lg">OKVEVO Pro</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-10">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center bg-gradient-to-r from-custom-orange via-orange-400 to-custom-orange bg-clip-text text-transparent">
                        Unlock Pro Features
                    </h1>
                    <p className="text-xl text-custom-cream/70 text-center mb-8">
                        Collaborate with your team in a Pro organization
                    </p>

                    {/* Features Grid */}
                    <div className="grid md:grid-cols-3 gap-6 mb-10">
                        <div className="text-center p-6 bg-custom-cream/5 rounded-2xl border border-custom-orange/20">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-custom-orange to-orange-600 rounded-xl mb-4">
                                <Users className="w-7 h-7 text-custom-cream" />
                            </div>
                            <h3 className="text-lg font-bold text-custom-orange mb-2">5-Seat Team</h3>
                            <p className="text-sm text-custom-cream/60">
                                Collaborate with up to 5 team members
                            </p>
                        </div>

                        <div className="text-center p-6 bg-custom-cream/5 rounded-2xl border border-custom-orange/20">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-custom-orange to-orange-600 rounded-xl mb-4">
                                <Sparkles className="w-7 h-7 text-custom-cream" />
                            </div>
                            <h3 className="text-lg font-bold text-custom-orange mb-2">Full Features</h3>
                            <p className="text-sm text-custom-cream/60">
                                Access all OKVEVO functionalities
                            </p>
                        </div>

                        <div className="text-center p-6 bg-custom-cream/5 rounded-2xl border border-custom-orange/20">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-custom-orange to-orange-600 rounded-xl mb-4">
                                <Crown className="w-7 h-7 text-custom-cream" />
                            </div>
                            <h3 className="text-lg font-bold text-custom-orange mb-2">No Restrictions</h3>
                            <p className="text-sm text-custom-cream/60">
                                Works with any email address
                            </p>
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="space-y-4">
                        <button
                            onClick={handleUpgradeToPro}
                            disabled={processing}
                            className="w-full bg-gradient-to-r from-custom-orange to-orange-600 hover:from-orange-600 hover:to-custom-orange text-custom-cream font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-custom-orange/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Crown className="w-5 h-5" />
                            Upgrade to Pro
                            <ArrowRight className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={processing}
                            className="w-full bg-custom-cream/5 hover:bg-custom-cream/10 border border-custom-orange/20 hover:border-custom-orange/40 text-custom-cream/70 hover:text-custom-cream font-medium py-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            ) : (
                                'Continue without Pro'
                            )}
                        </button>
                    </div>
                </div>

                {/* Info Note */}
                <div className="mt-6 text-center text-sm text-custom-cream/50">
                    You can upgrade to Pro anytime from your profile settings
                </div>
            </div>
        </div>
    );
}
