'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserSubscription } from '@/services/SubscriptionService';
import { Loader2 } from 'lucide-react';

interface SubscriptionGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export default function SubscriptionGuard({ children, fallback }: SubscriptionGuardProps) {
    const router = useRouter();
    const { userProfile, loading: authLoading } = useAuth();
    const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkSubscription = async () => {
            if (!userProfile) {
                setChecking(false);
                return;
            }

            if (process.env.NEXT_PUBLIC_BYPASS_SUBSCRIPTION === 'true') {
                console.log('🛠️ SUBSCRIPTION BYPASS ENABLED');
                setHasSubscription(true);
                setChecking(false);
                return;
            }

            try {
                const subscription = await getUserSubscription(userProfile.uid);
                const isActive = subscription?.status === 'active';
                setHasSubscription(isActive);

                if (!isActive) {
                    // Redirect to LandingPage Pricing section if no active subscription
                    router.push('/#pricing');
                }
            } catch (error) {
                console.error('Failed to check subscription:', error);
                setHasSubscription(false);
                router.push('/#pricing');
            } finally {
                setChecking(false);
            }
        };

        if (!authLoading) {
            checkSubscription();
        }
    }, [userProfile, authLoading, router]);

    if (authLoading || checking) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[#FF6B35] mx-auto mb-4" />
                    <p className="text-white/60">Checking subscription...</p>
                </div>
            </div>
        );
    }

    if (!hasSubscription) {
        return fallback || null;
    }

    return <>{children}</>;
}
