'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowLeft,
    ArrowUpRight,
    CheckCircle,
    Loader2,
    Receipt,
    TrendingDown,
    TrendingUp,
    X,
    Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
    getCreditHistory,
    subscribeUserBilling,
    type BillingSnapshot,
    type CreditTransaction,
} from '@/services/CreditsService';
import {
    formatPlanPrice,
    getPlanDetailsByPeriod,
    parseBillingCurrency,
    type BillingCurrency,
    type BillingPeriod,
    type SelfServePlanType,
} from '@/config/razorpay';
import { formatPctLabel } from '@/types/credits';
import { changeSubscriptionPlan } from '@/lib/billing/changeSubscription';
import {
    isLivePlanStatus,
    isPlanChangeTier,
    nextUpgradeTier,
    portalBillingActionFromSlug,
    toBillingPeriod,
} from '@/lib/billing/planChange';
import ChangePlanModal from '@/components/billing/ChangePlanModal';
import NoiseOverlay from '@/components/shared/NoiseOverlay';
import LoadingScreen from '@/components/shared/LoadingScreen';

function formatDate(date: Date | null, currency: BillingCurrency): string {
    if (!date) return '—';
    return date.toLocaleDateString(currency === 'INR' ? 'en-IN' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function UsageBar({ label, pct }: { label: string; pct: number }) {
    const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
    const shown = formatPctLabel(clamped);
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase tracking-widest text-white/50">{label}</p>
                <p className="text-2xl font-black text-white">{shown}</p>
            </div>
            <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clamped}
                className="h-2 bg-white/10 rounded-full overflow-hidden"
            >
                <div className="h-full bg-[#FF4D00] rounded-full" style={{ width: `${clamped}%` }} />
            </div>
        </div>
    );
}

export default function BillingPage() {
    const router = useRouter();
    const params = useParams<{ slug?: string | string[] }>();
    const action = portalBillingActionFromSlug(params.slug);
    const { user, userProfile, loading: authLoading, isAuthenticated } = useAuth();

    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showChangeModal, setShowChangeModal] = useState(action === 'change-plan' || action === 'upgrade');
    const [showCancelModal, setShowCancelModal] = useState(action === 'cancel');
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [changeBusy, setChangeBusy] = useState(false);
    const [changeError, setChangeError] = useState<string | null>(null);
    const [banner, setBanner] = useState<string | null>(null);

    const [topUpAmount, setTopUpAmount] = useState(10);
    const [topUpLoading, setTopUpLoading] = useState(false);
    const [topUpError, setTopUpError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated()) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (!userProfile) return;

        setLoading(true);
        setError(null);

        const unsubBilling = subscribeUserBilling(
            userProfile.uid,
            (snap) => {
                setBilling(snap);
                setLoading(false);
            },
            () => setError('Failed to load billing details. Please try again.')
        );

        getCreditHistory(userProfile.uid, 10)
            .then(setCreditHistory)
            .catch(() => setError('Failed to load billing details. Please try again.'));

        return () => unsubBilling();
    }, [userProfile]);

    const currency = parseBillingCurrency(billing?.currency, 'USD');
    const period = toBillingPeriod(billing?.billingCycle);
    const hasPlan = Boolean(billing?.razorpaySubscriptionId) && isLivePlanStatus(billing?.planStatus);
    const upgradeTier = nextUpgradeTier(billing?.plan);
    const cancelAtPeriodEnd = billing?.cancelAtPeriodEnd === true;
    const renewalDate = billing?.currentPeriodEnd ?? null;
    const periodEndLabel = formatDate(renewalDate, currency);
    const currentPlanLabel = billing?.planName || (isPlanChangeTier(billing?.plan) ? billing!.plan : 'None');

    const currentPrice = useMemo(() => {
        if (!isPlanChangeTier(billing?.plan)) return null;
        return getPlanDetailsByPeriod(billing.plan, period, currency);
    }, [billing?.plan, period, currency]);

    const upgradePrice = useMemo(() => {
        if (!upgradeTier) return null;
        return getPlanDetailsByPeriod(upgradeTier, period, currency);
    }, [upgradeTier, period, currency]);

    useEffect(() => {
        if (!billing || loading) return;
        if (action === 'upgrade' && upgradeTier && hasPlan && !cancelAtPeriodEnd && !billing.hasScheduledChanges) {
            setShowChangeModal(true);
        }
        if (action === 'change-plan' && hasPlan) setShowChangeModal(true);
        if (action === 'cancel' && hasPlan && !cancelAtPeriodEnd) setShowCancelModal(true);
    }, [billing, loading, action, upgradeTier, hasPlan, cancelAtPeriodEnd]);

    const authedPost = async (path: string, body: Record<string, unknown> = {}) => {
        if (!user) throw new Error('Not signed in');
        const idToken = await user.getIdToken();
        const response = await fetch(path, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${idToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        let data: Record<string, unknown> = {};
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            try {
                const parsed: unknown = await response.json();
                if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
            } catch {
                data = {};
            }
        }
        if (!response.ok) {
            throw new Error(typeof data.error === 'string' ? data.error : 'Request failed');
        }
        return data;
    };

    const handleAddCredits = async () => {
        const amount = Math.round(topUpAmount);
        if (amount < 5 || amount > 100) {
            setTopUpError('Amount must be between $5 and $100');
            return;
        }
        setTopUpLoading(true);
        setTopUpError(null);
        try {
            const data = await authedPost('/api/razorpay/create-payment-link', { amountUsd: amount });
            if (data.shortUrl) window.open(String(data.shortUrl), '_blank');
            else throw new Error('No payment link returned');
        } catch (err: unknown) {
            setTopUpError(err instanceof Error ? err.message : 'Failed to start checkout');
        } finally {
            setTopUpLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        setCancelling(true);
        setCancelError(null);
        try {
            await authedPost('/api/razorpay/cancel-subscription');
            setShowCancelModal(false);
            setBanner('Cancellation scheduled. You keep access until the end of this billing cycle.');
        } catch (err: unknown) {
            setCancelError(err instanceof Error ? err.message : 'Failed to cancel subscription.');
        } finally {
            setCancelling(false);
        }
    };

    const handlePlanChange = async (newPlanType: SelfServePlanType, newBillingPeriod: BillingPeriod) => {
        if (!user) return;
        setChangeBusy(true);
        setChangeError(null);
        try {
            const idToken = await user.getIdToken();
            const result = await changeSubscriptionPlan(idToken, newPlanType, newBillingPeriod);
            if (!result.ok) {
                setChangeError(result.error);
                return;
            }
            if (result.shortUrl) window.open(result.shortUrl, '_blank');
            setShowChangeModal(false);
            setBanner(result.message);
        } catch (err: unknown) {
            setChangeError(err instanceof Error ? err.message : 'Failed to update plan');
        } finally {
            setChangeBusy(false);
        }
    };

    const handleCancelScheduledChange = async () => {
        try {
            await authedPost('/api/razorpay/cancel-scheduled-change');
            setBanner('Scheduled plan change cancelled.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to cancel scheduled change');
        }
    };

    if (authLoading || loading) {
        return <LoadingScreen loadKey="billing" />;
    }

    const canMutatePlan = hasPlan && billing?.planStatus === 'active' && !cancelAtPeriodEnd;

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white relative overflow-x-hidden selection:bg-[#FF4D00]/30 selection:text-white pt-24 pb-32">
            <NoiseOverlay />
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <img src="/images/herobg.png" alt="" className="w-full h-full object-cover opacity-30 mix-blend-screen" />
            </div>

            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#0A0A0A]/40 px-8 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/workspace" className="flex items-center gap-3 group">
                        <ArrowLeft className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
                        <span className="text-sm font-black tracking-widest uppercase text-white/50 group-hover:text-white transition-colors">
                            Workspace
                        </span>
                    </Link>
                </div>
            </nav>

            <main className="relative z-10 max-w-5xl mx-auto px-6 w-full mt-8">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-center mb-16">
                    Billing<span className="text-[#FF4D00]">.</span>
                </h1>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-8 flex justify-center font-bold items-center gap-3">
                        <AlertCircle className="w-5 h-5" /> {error}
                    </div>
                )}
                {banner && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-2xl mb-8 flex justify-center font-bold items-center gap-3">
                        <CheckCircle className="w-5 h-5" /> {banner}
                    </div>
                )}

                <div className="w-full max-w-4xl mx-auto space-y-8">
                    {billing?.hasScheduledChanges && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-3xl p-6">
                            <h3 className="text-xl font-black text-blue-400 mb-2">Plan change scheduled</h3>
                            <p className="text-white/80 mb-4">
                                Switching to{' '}
                                <span className="font-bold text-white capitalize">{billing.scheduledPlanType || 'the new plan'}</span>
                                {billing.scheduledChangeAt ? ` on ${formatDate(billing.scheduledChangeAt, currency)}` : ' at cycle end'}.
                            </p>
                            <button
                                type="button"
                                onClick={handleCancelScheduledChange}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-bold uppercase tracking-widest"
                            >
                                Cancel change
                            </button>
                        </div>
                    )}

                    {cancelAtPeriodEnd && hasPlan && (
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-3xl p-6">
                            <h3 className="text-xl font-black text-orange-400 mb-2">Cancellation scheduled</h3>
                            <p className="text-white/80">
                                Won&apos;t renew — access until <span className="font-bold text-white">{periodEndLabel}</span>.
                            </p>
                        </div>
                    )}

                    {!hasPlan ? (
                        <div className="bg-[#111] border border-white/10 rounded-[2.5rem] p-16 text-center">
                            <h2 className="text-4xl font-black tracking-tight mb-4">No active subscription</h2>
                            <p className="text-white/50 mb-10 text-lg max-w-lg mx-auto">
                                Choose a plan to unlock Nia credits. Currency is set on the pricing page before checkout.
                            </p>
                            <Link
                                href="/pricing"
                                className="inline-flex items-center gap-2 px-10 py-4 bg-[#FF4D00] hover:bg-[#e64600] rounded-full text-white font-black uppercase tracking-widest text-sm"
                            >
                                <Zap className="w-5 h-5 fill-white" />
                                Explore Plans
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#111] border border-white/10 rounded-[2rem] p-8">
                                <p className="text-xs font-black uppercase tracking-widest text-white/50 mb-3">Current Plan</p>
                                <h2 className="text-4xl font-black tracking-tight mb-2">{currentPlanLabel}</h2>
                                {currentPrice && (
                                    <p className="text-xl font-bold text-[#FF4D00] mb-4">
                                        {formatPlanPrice(currentPrice.price, currency)}{' '}
                                        <span className="text-sm text-white/40 font-medium">
                                            / {currentPrice.period === 'annual' ? 'year' : 'month'}
                                        </span>
                                    </p>
                                )}
                                <p className="text-white/60">
                                    {cancelAtPeriodEnd ? 'Access until' : 'Renews'} {periodEndLabel}
                                </p>
                                <p className="text-xs text-white/40 mt-2 uppercase tracking-widest">{currency}</p>
                            </div>

                            {upgradeTier && upgradePrice && canMutatePlan && !billing?.hasScheduledChanges ? (
                                <div className="bg-gradient-to-br from-[#FF4D00]/10 to-orange-600/10 border border-[#FF4D00]/20 rounded-[2rem] p-8 flex flex-col">
                                    <p className="text-xs font-black uppercase tracking-widest text-white/50 mb-3">Upgrade available</p>
                                    <h2 className="text-4xl font-black tracking-tight mb-2">{upgradePrice.name}</h2>
                                    <p className="text-xl font-bold text-[#FF4D00] mb-6">
                                        {formatPlanPrice(upgradePrice.price, currency)}{' '}
                                        <span className="text-sm text-white/40 font-medium">
                                            / {upgradePrice.period === 'annual' ? 'year' : 'month'}
                                        </span>
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => handlePlanChange(upgradeTier, period)}
                                        disabled={changeBusy}
                                        className="mt-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FF4D00] hover:bg-[#e64600] rounded-full text-white font-black uppercase tracking-widest text-sm disabled:opacity-50"
                                    >
                                        {changeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                                        Upgrade
                                    </button>
                                    <p className="text-xs text-white/40 mt-3">
                                        {billing?.paymentMethod === 'upi' || billing?.paymentMethod === 'emandate'
                                            ? 'Full new-plan price via a new UPI payment. Existing credits stay until the new billing date.'
                                            : 'Pay the prorated difference now. Billing date stays the same.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-[#111] border border-white/10 rounded-[2rem] p-8 flex flex-col justify-center">
                                    <p className="text-xs font-black uppercase tracking-widest text-white/50 mb-3">Upgrade available</p>
                                    <p className="text-white/60">
                                        {upgradeTier
                                            ? cancelAtPeriodEnd
                                                ? 'Upgrade is paused while cancellation is scheduled.'
                                                : billing?.hasScheduledChanges
                                                  ? 'A plan change is already scheduled.'
                                                  : 'No upgrade right now.'
                                            : 'You are on the highest self-serve plan.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <UsageBar label="Plan remaining" pct={billing?.remainingPct ?? 0} />
                        <UsageBar label="Additional remaining" pct={billing?.additionalPct ?? 0} />
                    </div>

                    {hasPlan && (
                        <div className="flex justify-center gap-4 flex-wrap">
                            <button
                                type="button"
                                onClick={() => {
                                    setChangeError(null);
                                    setShowChangeModal(true);
                                }}
                                disabled={!canMutatePlan || billing?.hasScheduledChanges || changeBusy}
                                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest disabled:opacity-40"
                            >
                                Change Plan
                            </button>
                            {canMutatePlan ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCancelError(null);
                                        setShowCancelModal(true);
                                    }}
                                    className="px-8 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-full text-xs font-black uppercase tracking-widest text-red-400"
                                >
                                    Cancel Subscription
                                </button>
                            ) : cancelAtPeriodEnd ? (
                                <p className="px-8 py-4 bg-orange-500/10 border border-orange-500/30 rounded-full text-sm font-bold text-orange-300">
                                    Won&apos;t renew — access until {periodEndLabel}
                                </p>
                            ) : null}
                        </div>
                    )}

                    <div className="bg-gradient-to-br from-[#FF4D00]/10 to-orange-600/10 border border-[#FF4D00]/20 rounded-[2.5rem] p-10">
                        <h3 className="text-2xl font-black text-white mb-6">Add Credits</h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <label htmlFor="topUpAmount" className="sr-only">
                                    Amount in USD
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">$</span>
                                    <input
                                        id="topUpAmount"
                                        type="number"
                                        min={5}
                                        max={100}
                                        step={1}
                                        value={topUpAmount}
                                        onChange={(e) => setTopUpAmount(Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-bold focus:outline-none focus:border-[#FF4D00]/50"
                                    />
                                </div>
                                <p className="text-xs text-white/40 mt-2">
                                    $5 – $100 USD
                                    {currency === 'INR'
                                        ? ' · Charged in INR at ₹100 per USD ($10 → ₹1,000). Credits are still $ × 1,000.'
                                        : ' · Charged in USD.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddCredits}
                                disabled={topUpLoading}
                                className="px-8 py-3 bg-[#FF4D00] hover:bg-[#e64600] rounded-xl text-white font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {topUpLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Opening…
                                    </>
                                ) : (
                                    'Buy Credits'
                                )}
                            </button>
                        </div>
                        {topUpError && (
                            <p className="text-red-400 text-sm mt-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {topUpError}
                            </p>
                        )}
                    </div>

                    {creditHistory.length > 0 && (
                        <div className="bg-[#111] border border-white/10 rounded-[2.5rem] p-10">
                            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                                <Receipt className="w-5 h-5 text-[#FF4D00]" />
                                Recent Transactions
                            </h3>
                            <div className="space-y-3">
                                {creditHistory.map((transaction) => {
                                    const isDebit = transaction.type === 'debit';
                                    const Icon = isDebit ? TrendingDown : TrendingUp;
                                    const colorClass = isDebit ? 'text-red-400' : 'text-green-400';
                                    const label = [transaction.type, transaction.provider, transaction.model]
                                        .filter(Boolean)
                                        .join(' · ');
                                    return (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-full ${isDebit ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                                                    <Icon className={`w-4 h-4 ${colorClass}`} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white capitalize">{label}</p>
                                                    <p className="text-xs text-white/50 mt-1">
                                                        {transaction.createdAt?.toDate?.()?.toLocaleDateString('en-IN', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        }) || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className={`text-lg font-black ${colorClass}`}>
                                                {isDebit ? '−' : '+'}
                                                {transaction.amount.toLocaleString()}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {showChangeModal && hasPlan && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <ChangePlanModal
                                currentPlan={billing?.plan ?? null}
                                currentCycle={billing?.billingCycle ?? null}
                                currency={currency}
                                paymentMethod={billing?.paymentMethod ?? null}
                                periodEndLabel={periodEndLabel}
                                busy={changeBusy}
                                error={changeError}
                                onClose={() => !changeBusy && setShowChangeModal(false)}
                                onConfirm={handlePlanChange}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

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
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    onClick={() => !cancelling && setShowCancelModal(false)}
                                    disabled={cancelling}
                                    className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full disabled:opacity-50"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5 text-white/50" />
                                </button>
                                <h2 className="text-3xl font-black text-white mb-2">Cancel Subscription?</h2>
                                <p className="text-white/70 mb-6">
                                    Cancels at the end of this billing cycle. You keep access and credits until{' '}
                                    <span className="font-bold text-white">{periodEndLabel}</span>. No charge next cycle.
                                </p>
                                {cancelError && (
                                    <p className="text-red-400 text-sm mb-4 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {cancelError}
                                    </p>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCancelModal(false)}
                                        disabled={cancelling}
                                        className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-black uppercase tracking-widest disabled:opacity-50"
                                    >
                                        Keep Subscription
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelSubscription}
                                        disabled={cancelling}
                                        className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 rounded-full text-sm font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Cancel'}
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
