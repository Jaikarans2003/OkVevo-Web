'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    CreditCard,
    Calendar,
    CheckCircle,
    X,
    ArrowLeft,
    Loader2,
    AlertCircle,
    Receipt,
    Package,
    Clock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
    getUserSubscription,
    formatPrice,
    getStatusColor,
    getStatusLabel,
    type SubscriptionWithPlanDetails,
} from '@/services/SubscriptionService';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { getThemeClasses } from '@/utils/themeUtils';
import NoiseOverlay from '@/components/NoiseOverlay';

function BillingContent() {
    const router = useRouter();
    const { userProfile, loading: authLoading, isAuthenticated } = useAuth();
    const { theme, resolvedTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [subscription, setSubscription] = useState<SubscriptionWithPlanDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated()) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    // Load subscription data
    useEffect(() => {
        const loadSubscription = async () => {
            if (!userProfile) return;
            setLoading(true);
            setError(null);
            try {
                const sub = await getUserSubscription(userProfile.uid);
                setSubscription(sub);
            } catch (err) {
                console.error('Failed to load subscription:', err);
                setError('Failed to load subscription details. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (userProfile) {
            loadSubscription();
        }
    }, [userProfile]);

    if (authLoading || loading) {
        return (
            <div className={`min-h-screen ${tc.bg} flex items-center justify-center`}>
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-accent-orange mx-auto mb-4" />
                    <p className={`${tc.text} text-lg font-medium`}>Loading your billing details...</p>
                </div>
            </div>
        );
    }

    const formatDate = (timestamp: { toDate: () => Date } | Date | undefined) => {
        if (!timestamp) return 'N/A';
        const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    return (
        <div className={`min-h-screen ${tc.bg} ${tc.text} relative overflow-hidden transition-colors duration-500`}>
            {resolvedTheme === 'light' && <NoiseOverlay />}

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-accent-orange/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2000ms' }} />
            </div>

            {/* Header */}
            <header className={`${tc.sidebar} backdrop-blur-xl sticky top-0 z-40 border-b border-white/5`}>
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/workspace"
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-2xl font-bold text-accent-orange">Billing</h1>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-8 text-center font-medium"
                    >
                        {error}
                    </motion.div>
                )}

                {!subscription ? (
                    // No subscription state
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-20"
                    >
                        <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 bg-accent-orange/20 blur-2xl rounded-full" />
                            <CreditCard className="w-20 h-20 text-accent-orange relative z-10" />
                        </div>
                        <h2 className={`text-3xl font-bold ${tc.text} mb-3`}>No Active Subscription</h2>
                        <p className={`${tc.textDim} mb-8 text-lg max-w-md mx-auto`}>
                            You don't have an active subscription. Explore our plans to get started.
                        </p>
                        <Link
                            href="/pricing"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-accent-orange to-orange-600 rounded-full font-bold text-white hover:scale-105 hover:shadow-xl transition-all duration-300"
                        >
                            <Package className="w-5 h-5" />
                            View Plans
                        </Link>
                    </motion.div>
                ) : (
                    // Subscription details
                    <div className="space-y-8">
                        {/* Current Plan Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-3xl font-bold">{subscription.planDetails.name}</h2>
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${getStatusColor(subscription.status)} bg-opacity-20`}>
                                            <div className={`w-2 h-2 rounded-full ${getStatusColor(subscription.status)}`} />
                                            <span className="text-sm font-medium">{getStatusLabel(subscription.status)}</span>
                                        </div>
                                    </div>
                                    <p className="text-white/60">
                                        {formatPrice(subscription.planDetails.price)} / {subscription.planDetails.period}
                                    </p>
                                </div>
                                <div className="p-4 bg-accent-orange/10 rounded-2xl">
                                    <CreditCard className="w-8 h-8 text-accent-orange" />
                                </div>
                            </div>

                            {/* Subscription Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white/5 rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Calendar className="w-5 h-5 text-white/40" />
                                        <span className="text-sm text-white/60">Started On</span>
                                    </div>
                                    <p className="text-lg font-semibold">
                                        {formatDate(subscription.activatedAt || subscription.createdAt)}
                                    </p>
                                </div>

                                {subscription.nextBillingDate && subscription.status === 'active' && (
                                    <div className="bg-white/5 rounded-2xl p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Clock className="w-5 h-5 text-white/40" />
                                            <span className="text-sm text-white/60">Next Billing</span>
                                        </div>
                                        <p className="text-lg font-semibold">
                                            {formatDate(subscription.nextBillingDate)}
                                        </p>
                                    </div>
                                )}

                                <div className="bg-white/5 rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Receipt className="w-5 h-5 text-white/40" />
                                        <span className="text-sm text-white/60">Subscription ID</span>
                                    </div>
                                    <p className="text-sm font-mono text-white/80 truncate">
                                        {subscription.subscriptionId}
                                    </p>
                                </div>

                                {subscription.lastPaymentDate && (
                                    <div className="bg-white/5 rounded-2xl p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                            <span className="text-sm text-white/60">Last Payment</span>
                                        </div>
                                        <p className="text-lg font-semibold">
                                            {formatDate(subscription.lastPaymentDate)}
                                        </p>
                                        {subscription.lastPaymentAmount && (
                                            <p className="text-sm text-green-400">
                                                {formatPrice(subscription.lastPaymentAmount)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Payment History */}
                        {subscription.lastPaymentDate && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl"
                            >
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <Receipt className="w-5 h-5 text-accent-orange" />
                                    Recent Payment
                                </h3>
                                <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{subscription.planDetails.name}</p>
                                        <p className="text-sm text-white/60">
                                            {formatDate(subscription.lastPaymentDate)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold text-accent-orange">
                                            {subscription.lastPaymentAmount ? formatPrice(subscription.lastPaymentAmount) : formatPrice(subscription.planDetails.price)}
                                        </p>
                                        <p className="text-sm text-green-400 flex items-center gap-1 justify-end">
                                            <CheckCircle className="w-3 h-3" />
                                            Paid
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Status Messages */}
                        {subscription.status === 'cancelled' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-center gap-4"
                            >
                                <AlertCircle className="w-6 h-6 text-red-400" />
                                <div>
                                    <p className="font-semibold text-red-400">Subscription Cancelled</p>
                                    <p className="text-sm text-white/60">
                                        Your subscription was cancelled on {formatDate(subscription.cancelledAt)}
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {subscription.status === 'paused' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 flex items-center gap-4"
                            >
                                <AlertCircle className="w-6 h-6 text-yellow-400" />
                                <div>
                                    <p className="font-semibold text-yellow-400">Subscription Paused</p>
                                    <p className="text-sm text-white/60">
                                        Your subscription is currently paused since {formatDate(subscription.pausedAt)}
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-4">
                            <Link
                                href="/pricing"
                                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
                            >
                                Change Plan
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function BillingPage() {
    return (
        <ThemeProvider>
            <BillingContent />
        </ThemeProvider>
    );
}
