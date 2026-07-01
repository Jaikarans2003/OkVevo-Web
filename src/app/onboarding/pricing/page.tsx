"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import Pricing from '../../../components/ook/Pricing';
import { Loader2, ArrowLeft, Building2, Building } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

function OnboardingPricingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextStep = searchParams.get('next'); // 'organisation' | 'pro'

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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

    const handleHobbySuccess = (subscriptionId: string) => {
        console.log('Onboarding hobby subscription successful:', subscriptionId);
        if (nextStep === 'organisation') {
            // Hobby is fine for organisation
            router.push('/onboarding/organisation/form');
        } else {
            // Hobby plan cannot create Pro — go straight to intro
            router.push('/onboarding/intro');
        }
    };

    const handleProSuccess = (subscriptionId: string) => {
        console.log('Onboarding pro subscription successful:', subscriptionId);
        if (nextStep === 'organisation') {
            router.push('/onboarding/organisation/form');
        } else if (nextStep === 'pro') {
            router.push('/onboarding/pro/create');
        } else {
            router.push('/onboarding/intro');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    const backHref = nextStep === 'organisation'
        ? '/onboarding/organisation'
        : nextStep === 'pro'
            ? '/onboarding/pro'
            : '/onboarding';

    const contextLabel = nextStep === 'organisation'
        ? 'Organisation'
        : nextStep === 'pro'
            ? 'Pro (5 Seats)'
            : null;

    const ContextIcon = nextStep === 'pro' ? Building2 : Building;

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Back</span>
                    </Link>

                    <Link href="/" className="inline-block">
                        <Image
                            src="/OKVEVO Logos WithOut BackGrounds/White.svg"
                            alt="OKVEVO"
                            width={40}
                            height={40}
                            className="w-10 h-10"
                        />
                    </Link>

                    {contextLabel && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-accent-orange/10 border border-accent-orange/30 rounded-full">
                            <ContextIcon className="w-4 h-4 text-accent-orange" />
                            <span className="text-sm font-bold text-accent-orange">{contextLabel}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Context Banner */}
            {contextLabel && (
                <div className="max-w-3xl mx-auto px-6 pt-12 pb-0 text-center">
                    <p className="text-white/50 text-sm uppercase tracking-widest font-bold mb-3">
                        Step 2 of 3
                    </p>
                </div>
            )}

            {/* Pricing Component */}
            <Pricing
                user={user}
                onSuccessHobby={handleHobbySuccess}
                onSuccessPro={handleProSuccess}
                showOnlyPlan={nextStep === 'pro' ? 'Pro' : undefined}
            />
        </div>
    );
}

export default function OnboardingPricingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        }>
            <OnboardingPricingContent />
        </Suspense>
    );
}
