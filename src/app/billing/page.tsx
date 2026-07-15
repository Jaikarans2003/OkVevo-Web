'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
    Zap,
    TrendingDown,
    TrendingUp,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
    getUserSubscription,
    formatPrice,
    getStatusColor,
    getStatusLabel,
    type SubscriptionWithPlanDetails,
} from '@/services/SubscriptionService';
import { getCreditHistory, type CreditTransaction } from '@/services/CreditsService';
import { FEATURE_COSTS } from '@/types/credits';
import NoiseOverlay from '@/components/NoiseOverlay';

export default function BillingPage() {
    const router = useRouter();
    const { userProfile, loading: authLoading, isAuthenticated } = useAuth();
    const [subscription, setSubscription] = useState<SubscriptionWithPlanDetails | null>(null);
    const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated()) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    // Load subscription data and credit history
    useEffect(() => {
        const loadData = async () => {
            if (!userProfile) return;
            setLoading(true);
            setError(null);
            try {
                const [sub, history] = await Promise.all([
                    getUserSubscription(userProfile.uid),
                    getCreditHistory(userProfile.uid, 10)
                ]);
                setSubscription(sub);
                setCreditHistory(history);
            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Failed to load billing details. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (userProfile) {
            loadData();
        }
    }, [userProfile]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-[#FF4D00] animate-spin" />
            </div>
        );
    }

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        const date = timestamp instanceof Date ? timestamp : timestamp.toDate?.() || timestamp;
        return new Date(date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const handleCancelSubscription = async () => {
        if (!userProfile || !subscription) return;
        
        setCancelling(true);
        setCancelError(null);
        
        try {
            const response = await fetch('/api/razorpay/cancel-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userProfile.uid,
                    subscriptionId: subscription.subscriptionId,
                }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to cancel subscription');
            }
            
            // Reload subscription data
            const updatedSub = await getUserSubscription(userProfile.uid);
            setSubscription(updatedSub);
            setShowCancelModal(false);
        } catch (err: any) {
            console.error('Failed to cancel subscription:', err);
            setCancelError(err.message || 'Failed to cancel subscription. Please try again.');
        } finally {
            setCancelling(false);
        }
    };

    // Animation Configs
    const titleLetters = "BILLING".split('');
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
    };
    const letterVariants = {
        hidden: { opacity: 0, y: 40, filter: 'blur(10px)', scale: 0.8 },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: { type: 'spring' as const, damping: 12, stiffness: 100 } }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white relative overflow-x-hidden selection:bg-[#FF4D00]/30 selection:text-white pt-24 pb-32">
            <NoiseOverlay />

            {/* Background Image */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <img 
                    src="/images/herobg.png" 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-30 mix-blend-screen"
                />
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#0A0A0A]/40 px-8 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/workspace" className="flex items-center gap-3 group">
                        <ArrowLeft className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
                        <span className="text-sm font-black tracking-widest uppercase text-white/50 group-hover:text-white transition-colors">Workspace</span>
                    </Link>
                </div>
            </nav>

            <main className="relative z-10 max-w-5xl mx-auto px-6 w-full mt-8">


                <div className="w-full flex justify-center mb-16 relative z-20">
                     <motion.h1 
                        variants={containerVariants} 
                        initial="hidden" 
                        animate="show" 
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tight flex"
                    >
                        {titleLetters.map((char, index) => (
                            <motion.span key={index} variants={letterVariants} className="inline-block bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                                {char}
                            </motion.span>
                        ))}
                        <motion.span 
                            initial={{ opacity: 0, scale: 0 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            transition={{ delay: 1.2, type: 'spring' }} 
                            className="text-[#FF4D00]"
                        >
                            .
                        </motion.span>
                    </motion.h1>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-8 flex justify-center font-bold items-center gap-3"
                    >
                        <AlertCircle className="w-5 h-5" /> {error}
                    </motion.div>
                )}

                <div className="w-full max-w-4xl mx-auto relative">
                    {!subscription ? (
                        // No subscription state
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8, duration: 0.8 }}
                            className="bg-[#111] border border-white/10 rounded-[2.5rem] p-16 text-center shadow-2xl relative overflow-hidden group"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF4D00]/5 rounded-full blur-3xl group-hover:bg-[#FF4D00]/10 transition-colors duration-500" />
                            <div className="relative z-10">
                                <div className="inline-block p-6 bg-white/5 rounded-full mb-6">
                                    <Package className="w-16 h-16 text-white/20" />
                                </div>
                                <h2 className="text-4xl font-black tracking-tight mb-4 text-white">No Active Subscription</h2>
                                <p className="text-white/50 mb-10 text-lg max-w-lg mx-auto">
                                    You are currently on the free hobby tier. Explore our plans to unlock premium tools and generations.
                                </p>
                                <Link
                                    href="/#pricing"
                                    className="inline-flex items-center gap-2 px-10 py-4 bg-[#FF4D00] hover:bg-[#e64600] rounded-full text-white font-black uppercase tracking-widest text-sm hover:scale-105 transition-all duration-300"
                                >
                                    <Zap className="w-5 h-5 fill-white" />
                                    Explore Plans
                                </Link>
                            </div>
                        </motion.div>
                    ) : (
                        // Subscription details
                        <div className="space-y-8">
                            {/* Scheduled Plan Change Banner (Card/Netbanking) */}
                            {subscription.has_scheduled_changes && !subscription.cancelAtCycleEnd && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.7, duration: 0.5 }}
                                    className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-3xl p-6 shadow-xl"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-blue-500/20 rounded-full flex-shrink-0">
                                            <Calendar className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-xl font-black text-blue-400 mb-2">Plan Change Scheduled</h3>
                                            <p className="text-white/80 mb-3">
                                                Your plan will change from <span className="font-bold text-white">{subscription.planDetails.name}</span> to{' '}
                                                <span className="font-bold text-white capitalize">{subscription.scheduled_plan_type}</span> on{' '}
                                                <span className="font-bold text-white">{formatDate(subscription.change_scheduled_at)}</span>
                                            </p>
                                            <div className="flex gap-3 mt-4">
                                                <button
                                                    onClick={async () => {
                                                        if (!userProfile) return;
                                                        try {
                                                            const response = await fetch('/api/razorpay/cancel-scheduled-change', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    userId: userProfile.uid,
                                                                    subscriptionId: subscription.subscriptionId,
                                                                }),
                                                            });
                                                            if (response.ok) {
                                                                const updatedSub = await getUserSubscription(userProfile.uid);
                                                                setSubscription(updatedSub);
                                                            }
                                                        } catch (err) {
                                                            console.error('Failed to cancel scheduled change:', err);
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    Cancel Change
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* UPI Upgrade in Progress Banner */}
                            {subscription.being_replaced_by && subscription.status === 'active' && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.7, duration: 0.5 }}
                                    className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-3xl p-6 shadow-xl"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-green-500/20 rounded-full flex-shrink-0">
                                            <RefreshCw className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-xl font-black text-green-400 mb-2">Upgrade in Progress</h3>
                                            <p className="text-white/80 mb-3">
                                                Your new plan will activate on <span className="font-bold text-white">{formatDate(subscription.willCancelAt)}</span> when your current billing cycle ends.
                                            </p>
                                            <p className="text-sm text-white/60">
                                                Your current plan remains active until then. Both subscriptions will be visible until the transition completes.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Cancellation Scheduled Banner */}
                            {subscription.cancelAtCycleEnd && subscription.status === 'active' && !subscription.being_replaced_by && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.7, duration: 0.5 }}
                                    className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-3xl p-6 shadow-xl"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-orange-500/20 rounded-full flex-shrink-0">
                                            <AlertCircle className="w-6 h-6 text-orange-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-xl font-black text-orange-400 mb-2">Subscription Cancellation Scheduled</h3>
                                            <p className="text-white/80 mb-3">
                                                Your subscription will end on <span className="font-bold text-white">{formatDate(subscription.willCancelAt)}</span>.
                                            </p>
                                            <div className="space-y-1.5 text-sm text-white/70">
                                                <p className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                                    You can continue using all features until then
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                                    Your credits remain available until the end date
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                                    You will not be charged from your next billing cycle
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Current Plan Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8, duration: 0.8 }}
                                className="bg-[#111] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative"
                            >
                                {/* Mesh Gradient Area */}
                                <div className="absolute inset-0 opacity-40 pointer-events-none">
                                    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[120%] bg-gradient-to-br from-[#FF4D00] to-transparent rounded-full blur-[100px]" />
                                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[100%] bg-gradient-to-tl from-purple-800 to-transparent rounded-full blur-[100px]" />
                                </div>
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[20px] pointer-events-none" />

                                <div className="p-10 relative z-20">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                        <div>
                                            <div className="flex items-center gap-4 mb-2">
                                                <h2 className="text-4xl md:text-5xl font-black tracking-tight">{subscription.planDetails.name}</h2>
                                                <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full ${getStatusColor(subscription.status)} bg-opacity-20 backdrop-blur-md border border-white/5`}>
                                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(subscription.status)}`} />
                                                    <span className="text-xs font-bold uppercase tracking-widest">{getStatusLabel(subscription.status)}</span>
                                                </div>
                                            </div>
                                            <p className="text-2xl font-bold text-[#FF4D00]">
                                                {formatPrice(subscription.planDetails.price)} <span className="text-lg text-white/40">/ {subscription.planDetails.period}</span>
                                            </p>
                                        </div>
                                        <div className="p-5 bg-white/5 backdrop-blur-md rounded-full border border-white/10 shadow-xl self-start">
                                            <CreditCard className="w-10 h-10 text-white" />
                                        </div>
                                    </div>

                                    {/* Subscription Details Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Calendar className="w-4 h-4 text-[#FF4D00]" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Started On</span>
                                            </div>
                                            <p className="text-lg font-bold text-white">
                                                {formatDate(subscription.activatedAt || subscription.createdAt)}
                                            </p>
                                        </div>

                                        {subscription.nextBillingDate && subscription.status === 'active' && (
                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Clock className="w-4 h-4 text-[#FF4D00]" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Next Billing</span>
                                                </div>
                                                <p className="text-lg font-bold text-white">
                                                    {formatDate(subscription.nextBillingDate)}
                                                </p>
                                            </div>
                                        )}

                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors lg:col-span-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Receipt className="w-4 h-4 text-[#FF4D00]" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Subscription ID</span>
                                            </div>
                                            <p className="text-sm font-mono text-white/80 break-all">
                                                {subscription.subscriptionId}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Credits Overview Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.9, duration: 0.8 }}
                                className="bg-gradient-to-br from-[#FF4D00]/10 to-orange-600/10 border border-[#FF4D00]/20 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF4D00]/10 rounded-full blur-3xl" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-[#FF4D00]/20 rounded-full">
                                                <Zap className="w-6 h-6 text-[#FF4D00] fill-[#FF4D00]" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white">Credits Balance</h3>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                            <p className="text-xs font-black uppercase tracking-widest text-white/50 mb-2">Current Balance</p>
                                            <p className="text-4xl font-black text-white">{(subscription.credits || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                            <p className="text-xs font-black uppercase tracking-widest text-white/50 mb-2">Initial Credits</p>
                                            <p className="text-4xl font-black text-white/60">{(subscription.initialCredits || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                            <p className="text-xs font-black uppercase tracking-widest text-white/50 mb-2">Credits Used</p>
                                            <p className="text-4xl font-black text-red-400">{(subscription.creditsUsed || 0).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Feature Costs */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                        <h4 className="text-sm font-black uppercase tracking-widest text-white/50 mb-4">Credit Costs per Feature</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                                <span className="text-xs font-bold text-white/70">AI Studio</span>
                                                <span className="text-sm font-black text-[#FF4D00]">{FEATURE_COSTS.AI_INFLUENCER}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Credit Transaction History */}
                            {creditHistory.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1, duration: 0.8 }}
                                    className="bg-[#111] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl"
                                >
                                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                                        <Receipt className="w-5 h-5 text-[#FF4D00]" />
                                        Recent Credit Transactions
                                    </h3>
                                    <div className="space-y-3">
                                        {creditHistory.map((transaction) => {
                                            const isDeduction = transaction.amount < 0;
                                            const Icon = isDeduction ? TrendingDown : TrendingUp;
                                            const colorClass = isDeduction ? 'text-red-400' : 'text-green-400';
                                            
                                            return (
                                                <div
                                                    key={transaction.transactionId}
                                                    className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 rounded-full ${isDeduction ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                                                            <Icon className={`w-4 h-4 ${colorClass}`} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{transaction.reason}</p>
                                                            <p className="text-xs text-white/50 mt-1">
                                                                {transaction.createdAt?.toDate?.()?.toLocaleDateString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                }) || 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-lg font-black ${colorClass}`}>
                                                            {isDeduction ? '' : '+'}{transaction.amount.toLocaleString()}
                                                        </p>
                                                        <p className="text-xs text-white/50 mt-1">
                                                            Balance: {transaction.balanceAfter.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}

                            {/* Payment History & Statuses */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {subscription.lastPaymentDate && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1 }}
                                        className="bg-[#111] border border-white/10 rounded-3xl p-8 shadow-xl"
                                    >
                                        <h3 className="text-sm font-black uppercase tracking-widest text-white/50 mb-6 flex items-center gap-2">
                                            <Receipt className="w-4 h-4 text-white" />
                                            Recent Payment
                                        </h3>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-xl mb-1">{subscription.planDetails.name}</p>
                                                <p className="text-sm font-medium text-white/50">
                                                    {formatDate(subscription.lastPaymentDate)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-bold text-white mb-1">
                                                    {subscription.lastPaymentAmount ? formatPrice(subscription.lastPaymentAmount) : formatPrice(subscription.planDetails.price)}
                                                </p>
                                                <p className="text-xs font-bold uppercase tracking-widest text-green-400 flex items-center gap-1 justify-end">
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
                                        transition={{ delay: 1 }}
                                        className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 flex items-center gap-5 shadow-xl"
                                    >
                                        <div className="p-4 bg-red-500/20 rounded-full">
                                            <AlertCircle className="w-8 h-8 text-red-500" />
                                        </div>
                                        <div>
                                            <p className="font-black text-xl text-red-400 mb-1">Subscription Cancelled</p>
                                            <p className="text-sm font-medium text-white/70">
                                                Your subscription was cancelled on {formatDate(subscription.cancelledAt)}.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {subscription.status === 'paused' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1 }}
                                        className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-8 flex items-center gap-5 shadow-xl"
                                    >
                                        <div className="p-4 bg-yellow-500/20 rounded-full">
                                            <AlertCircle className="w-8 h-8 text-yellow-500" />
                                        </div>
                                        <div>
                                            <p className="font-black text-xl text-yellow-400 mb-1">Subscription Paused</p>
                                            <p className="text-sm font-medium text-white/70">
                                                Your subscription is currently paused since {formatDate(subscription.pausedAt)}.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex justify-center gap-4 pt-8 flex-wrap">
                                <Link
                                    href="/#pricing"
                                    className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest transition-colors shadow-xl"
                                >
                                    Change Plan
                                </Link>
                                
                                {subscription.status === 'active' && !subscription.cancelAtCycleEnd && (
                                    <button
                                        onClick={() => setShowCancelModal(true)}
                                        className="px-8 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-full text-xs font-black uppercase tracking-widest transition-colors shadow-xl text-red-400 hover:text-red-300"
                                    >
                                        Cancel Subscription
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Cancel Subscription Modal */}
                <AnimatePresence>
                    {showCancelModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => !cancelling && setShowCancelModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: 'spring', damping: 20 }}
                                className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => !cancelling && setShowCancelModal(false)}
                                    disabled={cancelling}
                                    className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                                >
                                    <X className="w-5 h-5 text-white/50" />
                                </button>

                                <div className="mb-6">
                                    <div className="inline-block p-4 bg-red-500/20 rounded-full mb-4">
                                        <AlertCircle className="w-8 h-8 text-red-400" />
                                    </div>
                                    <h2 className="text-3xl font-black text-white mb-2">Cancel Subscription?</h2>
                                    <p className="text-white/70">
                                        Your subscription will be cancelled at the end of your current billing cycle.
                                    </p>
                                </div>

                                {subscription && (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-white/50">Current Plan</span>
                                            <span className="text-sm font-bold text-white">{subscription.planDetails.name}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-white/50">Subscription Ends On</span>
                                            <span className="text-sm font-bold text-white">{formatDate(subscription.nextBillingDate)}</span>
                                        </div>
                                        <div className="border-t border-white/10 pt-3 mt-3">
                                            <div className="space-y-2 text-sm">
                                                <p className="flex items-start gap-2 text-white/70">
                                                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                    <span>You will continue to have access to all features and credits until <span className="font-bold text-white">{formatDate(subscription.nextBillingDate)}</span></span>
                                                </p>
                                                <p className="flex items-start gap-2 text-white/70">
                                                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                    <span>You will not be charged from your next billing cycle</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {cancelError && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4 flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p className="text-sm">{cancelError}</p>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowCancelModal(false)}
                                        disabled={cancelling}
                                        className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                                    >
                                        Keep Subscription
                                    </button>
                                    <button
                                        onClick={handleCancelSubscription}
                                        disabled={cancelling}
                                        className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 rounded-full text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {cancelling ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Cancelling...
                                            </>
                                        ) : (
                                            'Yes, Cancel'
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
