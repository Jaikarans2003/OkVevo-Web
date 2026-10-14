'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, Crown, Tag, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import RazorpayCheckout from '@/components/shared/payment/RazorpayCheckout';
import ContactUsModal from '@/components/shared/ContactUsModal';
import {
    SUBSCRIPTION_PLANS,
    ANNUAL_DISCOUNT_PCT,
    formatPlanPrice,
    getPlanDetailsByPeriod,
    type BillingCurrency,
    type SelfServePlanType,
} from '@/config/razorpay';
import { readCurrencyCookie, writeCurrencyCookie } from '@/lib/billing/currency';

type CouponValidationResponse = {
    valid: boolean;
    discountAmount: number;
    type: 'affiliate' | 'flat' | null;
    affiliateId?: string;
    message: string;
    finalAmount?: number;
    couponCode?: string;
};

interface PricingProps {
    user?: any;
    onSuccessMax?: (subscriptionId: string) => void;
    onSuccessPro?: (subscriptionId: string) => void;
    showOnlyPlan?: 'Starter' | 'Pro' | 'Max' | 'Enterprise';
}

const PAID_PLAN_TYPES: SelfServePlanType[] = ['starter', 'pro', 'max'];

const PLAN_ICONS: Record<SelfServePlanType, typeof Sparkles> = {
    starter: Sparkles,
    pro: Zap,
    max: Crown,
};

function couponAmountMinor(planType: SelfServePlanType, isAnnual: boolean, currency: BillingCurrency): number {
    const details = getPlanDetailsByPeriod(planType, isAnnual ? 'annual' : 'monthly', currency);
    return Math.round(details.price * 100);
}

const Pricing = ({ user, onSuccessMax, onSuccessPro, showOnlyPlan }: PricingProps) => {
    const [isAnnual, setIsAnnual] = useState(true);
    const [currency, setCurrency] = useState<BillingCurrency | null>(null);
    const [contactOpen, setContactOpen] = useState(false);
    const router = useRouter();

    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResponse | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');

    useEffect(() => {
        const cookie = readCurrencyCookie();
        if (cookie) {
            setCurrency(cookie);
            return;
        }
        let cancelled = false;
        fetch('/api/geo/detect')
            .then((r) => r.json())
            .then((data: { currency?: unknown }) => {
                if (cancelled) return;
                setCurrency(data.currency === 'INR' ? 'INR' : 'USD');
            })
            .catch(() => {
                if (!cancelled) setCurrency('USD');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const selectCurrency = (next: BillingCurrency) => {
        writeCurrencyCookie(next);
        setCurrency(next);
    };

    const handlePlanClick = (planName: string) => {
        if (!user) {
            sessionStorage.setItem('returnToPlan', planName.toLowerCase());
            router.push('/login');
        }
    };

    const handleApplyCoupon = async (planType: SelfServePlanType) => {
        if (!couponCode.trim()) {
            setCouponError('Please enter a coupon code');
            return;
        }

        setCouponLoading(true);
        setCouponError('');

        try {
            const totalAmount = couponAmountMinor(planType, isAnnual, currency ?? 'USD');

            const response = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    couponCode: couponCode.trim(),
                    phoneNumber: user?.phoneNumber || user?.email || '',
                    totalAmount,
                    billingPeriod: isAnnual ? 'annual' : 'monthly',
                    userId: user?.uid,
                }),
            });

            const data: CouponValidationResponse = await response.json();

            if (data.valid) {
                setAppliedCoupon(data);
                setCouponError('');
            } else {
                setCouponError(data.message);
                setAppliedCoupon(null);
            }
        } catch {
            setCouponError('Failed to validate coupon. Please try again.');
            setAppliedCoupon(null);
        } finally {
            setCouponLoading(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponError('');
    };

    const SHOW_PAID_PLANS = true;
    const savePct = currency
        ? Math.round(
              (1 -
                  getPlanDetailsByPeriod('starter', 'annual', currency).displayedMonthly /
                      getPlanDetailsByPeriod('starter', 'monthly', currency).price) *
                  100
          )
        : Math.round(ANNUAL_DISCOUNT_PCT * 100);

    const paidPlans = currency
        ? PAID_PLAN_TYPES.map((planType) => {
        const def = SUBSCRIPTION_PLANS[planType];
        const monthly = getPlanDetailsByPeriod(planType, 'monthly', currency);
        const annual = getPlanDetailsByPeriod(planType, 'annual', currency);
        const creditsLabel = `${(def.creditsIncluded / 1000).toLocaleString()}k`;

        const featuresByPlan: Record<SelfServePlanType, string[]> = {
            starter: [
                `${creditsLabel} monthly credits`,
                'Nia desktop agent',
                'Local-first AI workflows',
                'Standard model access',
            ],
            pro: [
                `${creditsLabel} monthly credits`,
                'Nia desktop agent',
                'Priority model routing',
                'Extended session history',
                'Email support',
            ],
            max: [
                `${creditsLabel} monthly credits`,
                'Nia desktop agent',
                'Highest model limits',
                'Extended session history',
                'Priority email support',
            ],
        };

        const notIncludedByPlan: Record<SelfServePlanType, string[]> = {
            starter: ['Priority support', 'Team admin controls'],
            pro: ['Team admin controls'],
            max: [],
        };

        return {
            planType,
            name: def.name,
            icon: PLAN_ICONS[planType],
            monthlyDisplay: formatPlanPrice(monthly.price, currency),
            annualDisplay: formatPlanPrice(annual.displayedMonthly, currency),
            yearlyTotalDisplay: formatPlanPrice(annual.price, currency),
            description:
                planType === 'starter'
                    ? 'For individuals getting started with Nia'
                    : planType === 'pro'
                      ? 'For power users scaling daily AI work'
                      : 'For creators and teams at maximum capacity',
            features: featuresByPlan[planType],
            notIncluded: notIncludedByPlan[planType],
            highlighted: planType === 'pro',
            cta: 'Get Plan',
        };
    })
        : [];

    const plans = [
        ...(SHOW_PAID_PLANS ? paidPlans : []),
        {
            planType: 'enterprise' as const,
            name: 'Enterprise',
            icon: Crown,
            monthlyDisplay: '',
            annualDisplay: '',
            yearlyTotalDisplay: '',
            description: 'For organizations scaling AI with full control and collaboration',
            features: [
                'Unlimited team seats',
                'Custom organization setup',
                'Custom credit allocation',
                'Admin access & controls',
                'Team management dashboard',
                'Priority technical support',
            ],
            notIncluded: [] as string[],
            highlighted: false,
            cta: 'Contact Sales',
        },
    ];

    return (
        <>
            <section id="pricing" data-section-theme="light" data-currency={currency ?? ''} className="relative scroll-mt-24 overflow-hidden bg-[#f6f1ec] py-28 font-sans text-[#2b2b2b] selection:bg-[#ff6d1f] selection:text-[#2b2b2b] md:py-36">
                <div className="relative z-10 mx-auto max-w-[1120px] px-6">
                    <div className="mb-16 text-center">
                        <motion.h2
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="nia-display mx-auto max-w-[12ch] text-5xl leading-[1.02] tracking-tight text-[#2b2b2b] md:text-7xl"
                        >
                            Pricing
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#2b2b2b]/70"
                        >
                            Choose a plan for Nia.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="mt-8 flex flex-wrap items-center justify-center gap-3"
                        >
                            <div
                                role="group"
                                aria-label="Billing period"
                                className="inline-flex rounded-full border border-[#2b2b2b]/10 bg-white p-1 shadow-[0_8px_24px_rgba(43,43,43,0.05)]"
                            >
                                {([false, true] as const).map((annual) => (
                                    <button
                                        key={annual ? 'annual' : 'monthly'}
                                        type="button"
                                        aria-pressed={isAnnual === annual}
                                        onClick={() => setIsAnnual(annual)}
                                        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6d1f] ${
                                            isAnnual === annual ? 'bg-[#2b2b2b] text-white' : 'text-[#2b2b2b]/60 hover:text-[#2b2b2b]'
                                        }`}
                                    >
                                        {annual ? 'Annual' : 'Monthly'}
                                        {annual ? (
                                            <span className="whitespace-nowrap rounded-full bg-[#c9962e] px-2 py-0.5 text-xs text-[#2b2b2b]">
                                                Save {savePct}%
                                            </span>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                            <div
                                role="group"
                                aria-label="Checkout currency"
                                className="inline-flex rounded-full border border-[#2b2b2b]/10 bg-white p-1 shadow-[0_8px_24px_rgba(43,43,43,0.05)]"
                            >
                                {(['USD', 'INR'] as const).map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => selectCurrency(c)}
                                        aria-pressed={currency === c}
                                        className={`rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6d1f] ${
                                            currency === c ? 'bg-[#ff6d1f] text-[#2b2b2b]' : 'text-[#2b2b2b]/60 hover:text-[#2b2b2b]'
                                        }`}
                                    >
                                        {c === 'INR' ? '₹ INR' : '$ USD'}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {SHOW_PAID_PLANS && (
                        <div
                            className={`grid gap-5 mx-auto ${
                                showOnlyPlan ? 'max-w-[480px]' : 'md:grid-cols-2 lg:grid-cols-3 max-w-[1100px]'
                            }`}
                        >
                            {plans
                                .filter((p) => (!showOnlyPlan || p.name === showOnlyPlan) && p.name !== 'Enterprise')
                                .map((plan, index) => {
                                    const planType = plan.planType as SelfServePlanType;
                                    return (
                                        <motion.div
                                            key={plan.name}
                                            initial={{ opacity: 0, y: 40 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.6, delay: index * 0.1 }}
                                            className={`group relative flex h-full flex-col rounded-[1.75rem] p-6 shadow-[0_16px_50px_rgba(43,43,43,0.06)] transition-colors duration-300 ${
                                                plan.highlighted
                                                    ? 'bg-white ring-2 ring-[#ff6d1f] lg:-translate-y-3'
                                                    : 'bg-white'
                                            }`}
                                        >
                                            {plan.highlighted && (
                                                <>
                                                    <div className="absolute inset-0 border border-orange-500/20 rounded-2xl pointer-events-none" />
                                                    <span className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#ff6d1f] px-3 py-1 text-xs font-medium text-[#2b2b2b]">
                                                        Most popular
                                                    </span>
                                                </>
                                            )}

                                            <div className="mb-3 relative z-10">
                                                <h3 className="mb-1 text-xl font-medium text-[#2b2b2b]">
                                                    {plan.name}
                                                </h3>
                                                <p className="text-[#888] text-xs leading-relaxed">{plan.description}</p>
                                            </div>

                                            <div className="h-px w-full bg-[#2b2b2b]/10 mb-4 relative z-10"></div>

                                            <div className="mb-4 relative z-10">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-medium tracking-tight text-[#2b2b2b]">
                                                        {isAnnual ? plan.annualDisplay : plan.monthlyDisplay}
                                                    </span>
                                                    <span className="text-[#888] text-sm font-medium tracking-tight uppercase">
                                                        / mo
                                                    </span>
                                                </div>
                                                {isAnnual && (
                                                    <p className="text-[#888] text-xs mt-1">
                                                        billed {plan.yearlyTotalDisplay} yearly
                                                    </p>
                                                )}
                                            </div>

                                            {user && (
                                                <div className="w-full mb-3 relative z-10">
                                                    {!appliedCoupon ? (
                                                        <div className="space-y-2">
                                                            <div className="flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                                    <input
                                                                        type="text"
                                                                        value={couponCode}
                                                                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                                        placeholder="Coupon / Affiliate Code"
                                                                        className="w-full rounded-lg border border-[#2b2b2b]/15 bg-[#f6f1ec] py-2.5 pl-10 pr-4 text-sm text-[#2b2b2b] placeholder:text-[#2b2b2b]/40 transition-colors focus:border-[#ff6d1f] focus:outline-none"
                                                                        disabled={couponLoading}
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => handleApplyCoupon(planType)}
                                                                    disabled={couponLoading || !couponCode.trim()}
                                                                    className="px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 rounded-lg text-orange-400 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                                >
                                                                    {couponLoading ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        'Apply'
                                                                    )}
                                                                </button>
                                                            </div>
                                                            {couponError && <p className="rounded-lg bg-[#a8422f] px-3 py-2 text-xs text-white">{couponError}</p>}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg bg-[#2c5a55] p-3">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-sm text-white">{appliedCoupon.message}</p>
                                                                    {appliedCoupon.discountAmount > 0 && (
                                                                        <p className="mt-0.5 text-xs text-white/80">
                                                                            Discount: {formatPlanPrice(appliedCoupon.discountAmount / 100, currency ?? 'USD')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={handleRemoveCoupon}
                                                                    className="text-xs text-white underline-offset-4 hover:underline"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="w-full mb-4 relative z-10">
                                                {user && currency ? (
                                                    <RazorpayCheckout
                                                        planType={planType}
                                                        billingPeriod={isAnnual ? 'annual' : 'monthly'}
                                                        currency={currency}
                                                        couponData={appliedCoupon}
                                                        highlighted={plan.highlighted}
                                                        onSuccess={(subscriptionId) => {
                                                            console.log('Subscription successful:', subscriptionId);
                                                            if (planType === 'max' && onSuccessMax) onSuccessMax(subscriptionId);
                                                            else if (planType === 'pro' && onSuccessPro) onSuccessPro(subscriptionId);
                                                            else router.push('/billing');
                                                        }}
                                                        onError={(error) => {
                                                            console.error('Subscription error:', error);
                                                            alert(`Subscription failed: ${error}`);
                                                        }}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => handlePlanClick(plan.name)}
                                                        disabled={!!user && !currency}
                                                        className={`w-full rounded-full py-3 text-sm font-medium text-[#2b2b2b] transition-transform duration-150 active:scale-[0.98] ${
                                                            plan.highlighted
                                                                ? 'bg-[#ff6d1f]'
                                                                : 'bg-[#c9962e]'
                                                        } ${user && !currency ? 'cursor-wait opacity-50' : ''}`}
                                                    >
                                                        {user && !currency ? 'Loading...' : plan.cta}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex-1 space-y-2.5 mb-4 relative z-10">
                                                {planType === 'pro' && (
                                                    <p className="text-orange-500/80 text-xs mb-4 font-bold uppercase tracking-widest">
                                                        Everything from Starter, plus:
                                                    </p>
                                                )}
                                                {planType === 'max' && (
                                                    <p className="text-orange-500/80 text-xs mb-4 font-bold uppercase tracking-widest">
                                                        Everything from Pro, plus:
                                                    </p>
                                                )}

                                                {plan.features.map((feature, i) => (
                                                    <div key={i} className="flex items-start gap-4 group/item">
                                                        <div className="mt-1 flex-shrink-0 transition-transform group-hover/item:rotate-12">
                                                            <Check
                                                                className={`h-4 w-4 ${plan.highlighted ? 'text-[#ff6d1f]' : 'text-[#2b2b2b]'}`}
                                                                strokeWidth={3}
                                                            />
                                                        </div>
                                                        <span className="text-[15px] leading-snug text-[#2b2b2b]/80">
                                                            {feature}
                                                        </span>
                                                    </div>
                                                ))}
                                                {plan.notIncluded.map((feature, i) => (
                                                    <div key={i} className="flex items-start gap-4 opacity-30">
                                                        <div className="mt-1 w-4 h-4 flex items-center justify-center flex-shrink-0">
                                                            <div className="w-2.5 h-[2px] bg-[#a1a1aa] rounded-full" />
                                                        </div>
                                                        <span className="text-[#a1a1aa] text-[15px] leading-snug line-through">{feature}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                        </div>
                    )}

                    {!showOnlyPlan && (
                        <div className="max-w-[1100px] mx-auto mt-8">
                            {plans
                                .filter((p) => p.name === 'Enterprise')
                                .map((plan) => (
                                    <motion.div
                                        key={plan.name}
                                        initial={{ opacity: 0, y: 40 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.6, delay: 0.3 }}
                                        className="relative flex flex-col gap-8 rounded-[1.75rem] bg-white p-8 shadow-[0_16px_50px_rgba(43,43,43,0.06)] md:flex-row md:items-center"
                                    >
                                        <div className="md:w-1/3 relative z-10">
                                            <h3 className="mb-2 text-3xl font-medium tracking-tight text-[#2b2b2b]">
                                                {plan.name}
                                            </h3>
                                            <p className="text-[#888] text-sm leading-relaxed mb-4">{plan.description}</p>
                                        </div>

                                        <div className="hidden md:block w-px h-32 bg-[#2b2b2b]/10"></div>

                                        <div className="md:flex-1 relative z-10">
                                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {plan.features.map((feature, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-sm text-[#2b2b2b]/80">
                                                        <svg
                                                            className="w-5 h-5 text-orange-500 shrink-0 mt-0.5"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                        <span className="leading-relaxed">
                                                            {feature}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="md:w-48 relative z-10">
                                            <button
                                                onClick={() => setContactOpen(true)}
                                                className="w-full rounded-full bg-[#ff6d1f] px-6 py-4 text-sm font-medium text-[#2b2b2b] transition-transform duration-150 active:scale-[0.98]"
                                            >
                                                Contact Sales
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                        </div>
                    )}
                </div>
            </section>

            <ContactUsModal isOpen={contactOpen} onClose={() => setContactOpen(false)} defaultCategory="enterpriseEnquiry" />
        </>
    );
};

export default Pricing;
