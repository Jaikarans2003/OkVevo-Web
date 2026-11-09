'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowUpRight,
    CalendarClock,
    CheckCircle,
    DollarSign,
    Loader2,
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
import PortalShell from '@/components/portal/PortalShell';
import DrawnArt from '@/components/landing-page/DrawnArt';
import LoadingScreen from '@/components/shared/LoadingScreen';

function formatDate(date: Date | null, currency: BillingCurrency): string {
    if (!date) return '—';
    return date.toLocaleDateString(currency === 'INR' ? 'en-IN' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function UsageBar({ label, pct, spot }: { label: string; pct: number; spot: string }) {
    const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
    const shown = formatPctLabel(clamped);
    return (
        <div className="pt-meter" style={{ '--spot': spot } as CSSProperties}>
            <div className="pt-meter-top">
                <p className="pt-label">{label}</p>
                <b>{shown}</b>
            </div>
            <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clamped}
                className="pt-track"
            >
                <div className="pt-fill" data-empty={clamped === 0 ? '' : undefined} style={{ width: `${clamped}%` }} />
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
    const spot = (ink: string) => ({ '--spot': `var(--${ink})` } as CSSProperties);

    return (
        <PortalShell>
            <section className="wrap pt-head">
                <div>
                    <h1>Billing<span>.</span></h1>
                    <p className="sub">Your plan, your credits and every top-up, in one place.</p>
                </div>
                <DrawnArt name="billing" layers={6} width={1100} height={917} float={[3]} className="pt-art"
                    alt="Two jars of coins, an orange one for plan credits and a teal one for purchased credits, with coins dropping in" />
            </section>

            <div className="wrap pt-stack">
                {error && (
                    <p className="pt-note pt-note--bad" role="alert">
                        <AlertCircle size={18} aria-hidden /> {error}
                    </p>
                )}
                {banner && (
                    <p className="pt-note pt-note--good" role="status">
                        <CheckCircle size={18} aria-hidden /> {banner}
                    </p>
                )}

                {billing?.hasScheduledChanges && (
                    <div className="pt-note pt-note--info">
                        <CalendarClock size={20} aria-hidden />
                        <div>
                            <h3>Plan change scheduled</h3>
                            <p>
                                Switching to{' '}
                                <b style={{ textTransform: 'capitalize' }}>{billing.scheduledPlanType || 'the new plan'}</b>
                                {billing.scheduledChangeAt ? ` on ${formatDate(billing.scheduledChangeAt, currency)}` : ' at cycle end'}.
                            </p>
                            <button type="button" onClick={handleCancelScheduledChange} className="btn">
                                Cancel change
                            </button>
                        </div>
                    </div>
                )}

                {cancelAtPeriodEnd && hasPlan && (
                    <div className="pt-note">
                        <CalendarClock size={20} aria-hidden />
                        <div>
                            <h3>Cancellation scheduled</h3>
                            <p>
                                Won&apos;t renew. Access until <b>{periodEndLabel}</b>.
                            </p>
                        </div>
                    </div>
                )}

                {!hasPlan ? (
                    <section className="sheet sheet--teal on-dark pt-sheet pt-empty">
                        <h2>No active subscription</h2>
                        <p className="sub">
                            Choose a plan to unlock Nia credits. Currency is set on the pricing page before checkout.
                        </p>
                        <Link href="/pricing" className="btn btn--go">
                            <Zap size={16} aria-hidden />
                            Explore plans
                        </Link>
                    </section>
                ) : (
                    <div className="pt-grid2">
                        <article className="prin" style={spot('orange')}>
                            <p className="pt-label">Current Plan</p>
                            <h2 className="pt-big">{currentPlanLabel}</h2>
                            {currentPrice && (
                                <p className="pt-price">
                                    {formatPlanPrice(currentPrice.price, currency)}{' '}
                                    <small>/ {currentPrice.period === 'annual' ? 'year' : 'month'}</small>
                                </p>
                            )}
                            <p>
                                {cancelAtPeriodEnd ? 'Access until' : 'Renews'} {periodEndLabel}
                            </p>
                            <p className="pt-fine">Billed in {currency}</p>
                        </article>

                        {upgradeTier && upgradePrice && canMutatePlan && !billing?.hasScheduledChanges ? (
                            <article className="prin" style={spot('teal')}>
                                <p className="pt-label">Upgrade available</p>
                                <h2 className="pt-big">{upgradePrice.name}</h2>
                                <p className="pt-price">
                                    {formatPlanPrice(upgradePrice.price, currency)}{' '}
                                    <small>/ {upgradePrice.period === 'annual' ? 'year' : 'month'}</small>
                                </p>
                                <button
                                    type="button"
                                    onClick={() => handlePlanChange(upgradeTier, period)}
                                    disabled={changeBusy}
                                    className="btn btn--go"
                                >
                                    {changeBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ArrowUpRight size={16} aria-hidden />}
                                    Upgrade
                                </button>
                                <p className="pt-fine">
                                    {billing?.paymentMethod === 'upi' || billing?.paymentMethod === 'emandate'
                                        ? 'Full new-plan price via a new UPI payment. Existing credits stay until the new billing date.'
                                        : 'Pay the prorated difference now. Billing date stays the same.'}
                                </p>
                            </article>
                        ) : (
                            <article className="prin" style={spot('slate')}>
                                <p className="pt-label">Upgrade available</p>
                                <p>
                                    {upgradeTier
                                        ? cancelAtPeriodEnd
                                            ? 'Upgrade is paused while cancellation is scheduled.'
                                            : billing?.hasScheduledChanges
                                              ? 'A plan change is already scheduled.'
                                              : 'No upgrade right now.'
                                        : 'You are on the highest self-serve plan.'}
                                </p>
                            </article>
                        )}
                    </div>
                )}

                <div className="pt-grid2">
                    <UsageBar label="Plan remaining" pct={billing?.remainingPct ?? 0} spot="var(--orange)" />
                    <UsageBar label="Additional remaining" pct={billing?.additionalPct ?? 0} spot="var(--teal)" />
                </div>

                {hasPlan && (
                    <div className="pt-row">
                        <button
                            type="button"
                            onClick={() => {
                                setChangeError(null);
                                setShowChangeModal(true);
                            }}
                            disabled={!canMutatePlan || billing?.hasScheduledChanges || changeBusy}
                            className="btn"
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
                                className="btn btn--danger"
                            >
                                Cancel Subscription
                            </button>
                        ) : cancelAtPeriodEnd ? (
                            <p className="pt-note">Won&apos;t renew. Access until {periodEndLabel}</p>
                        ) : null}
                    </div>
                )}

                <section className="sheet sheet--olive on-dark pt-sheet pt-topup">
                    <div>
                        <h2>Add Credits</h2>
                        <p className="sub">Top-up credits never expire on their own. They&apos;re spent after your plan&apos;s credits run out.</p>
                    </div>
                    <div>
                        <div className="pt-topup-form">
                            <div className="pt-field">
                                <label htmlFor="topUpAmount">Amount in USD</label>
                                <div className="pt-input-icon">
                                    <DollarSign size={18} aria-hidden />
                                    <input
                                        id="topUpAmount"
                                        type="number"
                                        min={5}
                                        max={100}
                                        step={1}
                                        value={topUpAmount}
                                        onChange={(e) => setTopUpAmount(Number(e.target.value))}
                                        className="pt-input"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddCredits}
                                disabled={topUpLoading}
                                className="btn btn--go"
                                style={{ marginTop: 26 }}
                            >
                                {topUpLoading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" aria-hidden />
                                        Opening…
                                    </>
                                ) : (
                                    'Buy Credits'
                                )}
                            </button>
                        </div>
                        <p className="pt-fine">
                            $5 – $100 USD
                            {currency === 'INR'
                                ? ' · Charged in INR at ₹100 per USD ($10 → ₹1,000). Credits are still $ × 1,000.'
                                : ' · Charged in USD.'}
                        </p>
                        {topUpError && (
                            <p className="pt-note pt-note--bad" role="alert" style={{ marginTop: 12 }}>
                                <AlertCircle size={18} aria-hidden />
                                {topUpError}
                            </p>
                        )}
                    </div>
                </section>

                {creditHistory.length > 0 && (
                    <section className="pt-ledger">
                        <h2>Recent Transactions</h2>
                        <ul>
                            {creditHistory.map((transaction) => {
                                const isDebit = transaction.type === 'debit';
                                const Icon = isDebit ? TrendingDown : TrendingUp;
                                const label = [transaction.type, transaction.provider, transaction.model]
                                    .filter(Boolean)
                                    .join(' · ');
                                return (
                                    <li key={transaction.id} style={spot(isDebit ? 'rust' : 'olive')}>
                                        <span className="ic"><Icon size={16} aria-hidden /></span>
                                        <div>
                                            <p className="what">{label}</p>
                                            <p className="when">
                                                {transaction.createdAt?.toDate?.()?.toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                }) || 'N/A'}
                                            </p>
                                        </div>
                                        <p className="amt">
                                            {isDebit ? '−' : '+'}
                                            {transaction.amount.toLocaleString()}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
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
                        className="pt-modal-back"
                        onClick={() => !cancelling && setShowCancelModal(false)}
                    >
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="cancel-title"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="pt-modal"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => !cancelling && setShowCancelModal(false)}
                                disabled={cancelling}
                                className="pt-x"
                                aria-label="Close"
                            >
                                <X size={18} aria-hidden />
                            </button>
                            <h2 id="cancel-title">Cancel subscription?</h2>
                            <p>
                                Cancels at the end of this billing cycle. You keep access and credits until{' '}
                                <b>{periodEndLabel}</b>. No charge next cycle.
                            </p>
                            {cancelError && (
                                <p className="pt-err" role="alert" style={{ marginBottom: 16 }}>
                                    <AlertCircle size={16} aria-hidden />
                                    {cancelError}
                                </p>
                            )}
                            <div className="pt-row">
                                <button
                                    type="button"
                                    onClick={() => setShowCancelModal(false)}
                                    disabled={cancelling}
                                    className="btn"
                                >
                                    Keep subscription
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelSubscription}
                                    disabled={cancelling}
                                    className="btn btn--danger"
                                >
                                    {cancelling ? <Loader2 size={16} className="animate-spin" aria-hidden /> : 'Yes, cancel'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </PortalShell>
    );
}
