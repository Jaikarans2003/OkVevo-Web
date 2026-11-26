'use client';

/**
 * Plan change, cancel, and add-credits for the wallet on screen.
 * Same controls and Razorpay routes as the old /dashboard/billing page.
 * Personal passes org=null; an org wallet passes that org id. Prepaid
 * wallets (canPurchase false) keep the funded-by note and no checkout.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
import { usePortalAuth } from '@/components/portal/PortalAuth';
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
import { changeSubscriptionPlan } from '@/lib/billing/changeSubscription';
import {
    isLivePlanStatus,
    isPlanChangeTier,
    nextUpgradeTier,
    portalBillingActionFromSlug,
    toBillingPeriod,
} from '@/lib/billing/planChange';
import { overdrawnSentence } from '@/lib/orgs/dashboardHelpers';
import { useAccount } from '@/lib/orgs/accountContext';
import ChangePlanModal from '@/components/billing/ChangePlanModal';
import UsageBar from '@/components/billing/UsageBar';

function formatDate(date: Date | null, currency: BillingCurrency): string {
    if (!date) return '—';
    return date.toLocaleDateString(currency === 'INR' ? 'en-IN' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function AccountBillingActions() {
    const account = useAccount();
    const org = account?.account === 'org' ? account.publicId : null;
    const accountKind = account?.account ?? null;
    const params = useParams<{ slug?: string | string[] }>();
    const action = portalBillingActionFromSlug(params.slug);
    const { user, ready } = usePortalAuth();

    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showChangeModal, setShowChangeModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [changeBusy, setChangeBusy] = useState(false);
    const [changeError, setChangeError] = useState<string | null>(null);
    const [banner, setBanner] = useState<string | null>(null);

    const [topUpAmount, setTopUpAmount] = useState(10);
    const [topUpLoading, setTopUpLoading] = useState(false);
    const [topUpError, setTopUpError] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !accountKind) return;

        setLoading(true);
        setError(null);

        const unsubBilling = subscribeUserBilling(
            user,
            (snap) => {
                setBilling(snap);
                setLoading(false);
            },
            () => {
                setError('Failed to load billing details. Please try again.');
                setLoading(false);
            },
            org
        );

        getCreditHistory(user, 10, org)
            .then(setCreditHistory)
            .catch(() => setError('Failed to load billing details. Please try again.'));

        return () => unsubBilling();
    }, [user, accountKind, org]);

    const currency = parseBillingCurrency(billing?.currency, 'USD');
    const period = toBillingPeriod(billing?.billingCycle);
    const hasPlan = Boolean(billing?.razorpaySubscriptionId) && isLivePlanStatus(billing?.planStatus);
    const upgradeTier = nextUpgradeTier(billing?.plan);
    const cancelAtPeriodEnd = billing?.cancelAtPeriodEnd === true;
    const renewalDate = billing?.currentPeriodEnd ?? null;
    const periodEnded = billing?.planStatus === 'ended';
    const periodEndLabel = periodEnded ? 'Ended' : formatDate(renewalDate, currency);
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
        const allowed = billing.canPurchase !== false;
        if (!allowed) {
            setShowChangeModal(false);
            setShowCancelModal(false);
            return;
        }
        if (action === 'upgrade' && upgradeTier && hasPlan && !cancelAtPeriodEnd && !billing.hasScheduledChanges) {
            setShowChangeModal(true);
        }
        if (action === 'change-plan' && hasPlan) setShowChangeModal(true);
        if (action === 'cancel' && hasPlan && !cancelAtPeriodEnd) setShowCancelModal(true);
    }, [billing, loading, action, upgradeTier, hasPlan, cancelAtPeriodEnd]);

    const authedPost = async (path: string, body: Record<string, unknown> = {}) => {
        if (!user) throw new Error('Not signed in');
        const { authedFetch } = await import('@/lib/api/browser');
        const response = await authedFetch(user, path, {
            method: 'POST',
            body: JSON.stringify(body),
            org,
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
            const result = await changeSubscriptionPlan(user, newPlanType, newBillingPeriod, org);
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

    if (!account || !ready || !user || loading) {
        return (
            <p className="text-sm text-muted-foreground" role="status" aria-busy="true">
                Loading billing
            </p>
        );
    }

    const canPurchase = billing?.canPurchase !== false;
    const canMutatePlan =
        canPurchase && hasPlan && billing?.planStatus === 'active' && !cancelAtPeriodEnd;
    const spot = (ink: string) => ({ '--spot': `var(--${ink})` } as CSSProperties);

    return (
        <>
            <div className="pt-stack">
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
                                {' '}This cannot be undone — the current plan already ends at that date.
                            </p>
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
                            Choose a plan to unlock OkVevo credits. Currency is set on the pricing page before checkout.
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
                    <UsageBar label="Your credits · plan" pct={billing?.remainingPct ?? 0} spot="var(--orange)" />
                    <UsageBar
                        label={
                            billing?.additionalNextExpiry
                                ? `Your credits · additional · next expiry ${formatDate(billing.additionalNextExpiry, currency)}`
                                : 'Your credits · additional'
                        }
                        pct={billing?.additionalPct ?? 0}
                        spot="var(--teal)"
                    />
                </div>

                {(billing?.fundedBy || (billing?.sponsoredPct ?? 0) > 0 || (billing?.overdrawnPct ?? 0) > 0) && (
                    <div className="pt-stack" style={{ gap: 12 }}>
                        <UsageBar
                            label={billing?.fundedBy ? `From ${billing.fundedBy}` : 'Sponsored credits'}
                            pct={billing?.sponsoredPct ?? 0}
                            spot="var(--olive)"
                        />
                        {(billing?.overdrawnPct ?? 0) > 0 && billing?.fundedBy ? (
                            <p className="pt-note pt-note--bad" role="status">
                                <AlertCircle size={18} aria-hidden />{' '}
                                {overdrawnSentence(billing.overdrawnPct, billing.fundedBy)}
                            </p>
                        ) : null}
                    </div>
                )}

                {cancelAtPeriodEnd && hasPlan ? (
                    <p className="pt-note pt-note--info" role="status">
                        <CalendarClock size={18} aria-hidden /> Your previous plan ends on {periodEndLabel}.
                        {canPurchase ? (
                            <>
                                {' '}
                                <Link href="/pricing" className="pt-link">Buy a new plan</Link>
                            </>
                        ) : null}
                    </p>
                ) : null}

                {hasPlan && canPurchase && (
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
                        <p className="sub">
                            Additional credits expire 1 year after purchase. They&apos;re spent after your plan&apos;s
                            credits run out.
                            {billing?.additionalNextExpiry
                                ? ` Next expiry ${formatDate(billing.additionalNextExpiry, currency)}.`
                                : ''}
                        </p>
                    </div>
                    <div>
                        {!canPurchase ? (
                            <p className="pt-note">
                                Credits are provided by {billing?.fundedBy || 'your organisation'}. Ask your
                                organisation admin for more.
                            </p>
                        ) : (
                            <>
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
                                                disabled={hasPlan && billing?.entitled === false}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddCredits}
                                        disabled={topUpLoading || (hasPlan && billing?.entitled === false)}
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
                            </>
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
                                const label = [transaction.type, transaction.modelLabel]
                                    .filter(Boolean)
                                    .join(' · ');
                                return (
                                    <li key={transaction.id} style={spot(isDebit ? 'rust' : 'olive')}>
                                        <span className="ic"><Icon size={16} aria-hidden /></span>
                                        <div>
                                            <p className="what">{label}</p>
                                            <p className="when">
                                                {transaction.createdAt?.toLocaleDateString('en-IN', {
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
                {showChangeModal && canPurchase && hasPlan && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <ChangePlanModal
                            currentPlan={billing?.plan ?? null}
                            currentCycle={billing?.billingCycle ?? null}
                            currency={currency}
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
                {showCancelModal && canPurchase && hasPlan && (
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
        </>
    );
}
