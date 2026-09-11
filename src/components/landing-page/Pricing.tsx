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
    annualChargeUsd,
    displayedYearlyMonthlyUsd,
    type SelfServePlanType,
} from '@/config/razorpay';

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

function formatUsd(amount: number): string {
    return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function couponAmountCents(planType: SelfServePlanType, isAnnual: boolean): number {
    const monthly = SUBSCRIPTION_PLANS[planType].monthlyPriceUsd;
    const priceUsd = isAnnual ? annualChargeUsd(monthly) : monthly;
    return Math.round(priceUsd * 100);
}

const Pricing = ({ user, onSuccessMax, onSuccessPro, showOnlyPlan }: PricingProps) => {
    const [isAnnual, setIsAnnual] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [contactOpen, setContactOpen] = useState(false);
    const router = useRouter();

    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResponse | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');

    useEffect(() => {
        setMounted(true);
    }, []);

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
            const totalAmount = couponAmountCents(planType, isAnnual);

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

    const paidPlans = PAID_PLAN_TYPES.map((planType) => {
        const def = SUBSCRIPTION_PLANS[planType];
        const monthlyUsd = def.monthlyPriceUsd;
        const yearlyMonthlyUsd = displayedYearlyMonthlyUsd(monthlyUsd);
        const yearlyTotalUsd = annualChargeUsd(monthlyUsd);
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
            monthlyDisplay: formatUsd(monthlyUsd),
            annualDisplay: formatUsd(yearlyMonthlyUsd),
            yearlyTotalDisplay: formatUsd(yearlyTotalUsd),
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
    });

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
            <section id="pricing" data-section-theme="dark" className="relative py-24 bg-black font-sans selection:bg-orange-500/30 overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-48 md:h-64 bg-gradient-to-b from-black via-black/80 to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-0 inset-x-0 h-32 md:h-48 bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none" />

                <div className="absolute inset-0 z-0 pointer-events-none mt-32">
                    <div className="absolute top-[20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-3xl transform-gpu" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-orange-700/10 blur-3xl transform-gpu" />

                    <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="xMidYMid slice">
                        <defs>
                            <radialGradient id="price-mesh-1" cx="20%" cy="60%" r="50%">
                                <stop offset="0%" stopColor="#FF6600" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="transparent" />
                            </radialGradient>
                            <radialGradient id="price-mesh-2" cx="80%" cy="80%" r="50%">
                                <stop offset="0%" stopColor="#FF4500" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="transparent" />
                            </radialGradient>
                            <radialGradient id="price-mesh-3" cx="50%" cy="70%" r="60%">
                                <stop offset="0%" stopColor="#FF8C00" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="transparent" />
                            </radialGradient>
                            <pattern id="pricing-grid" width="80" height="80" patternUnits="userSpaceOnUse">
                                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
                                <circle cx="0" cy="0" r="1.5" fill="white" fillOpacity="0.1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#price-mesh-1)" />
                        <rect width="100%" height="100%" fill="url(#price-mesh-2)" />
                        <rect width="100%" height="100%" fill="url(#price-mesh-3)" />
                        <rect width="100%" height="100%" fill="url(#pricing-grid)" />
                    </svg>

                    {mounted &&
                        [...Array(10)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="absolute w-[2px] h-[2px] bg-orange-400 rounded-full blur-[1px]"
                                initial={{
                                    x: Math.random() * 100 + '%',
                                    y: Math.random() * 100 + '%',
                                    opacity: 0,
                                    scale: 0,
                                }}
                                animate={{
                                    y: [null, '-30%'],
                                    opacity: [0, 0.8, 0],
                                    scale: [0, 1.5, 0],
                                    x: [null, (Math.random() - 0.5) * 60 + 'px'],
                                }}
                                transition={{
                                    duration: Math.random() * 15 + 10,
                                    repeat: Infinity,
                                    delay: Math.random() * 5,
                                    ease: 'easeInOut',
                                }}
                            />
                        ))}
                </div>

                <div className="max-w-[1500px] mx-auto px-6 relative z-10">
                    <div className="text-center mb-6">
                        <motion.h2
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                            className="text-5xl md:text-[80px] font-bold mb-2 text-white tracking-tight leading-none"
                        >
                            Pricing
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="text-[#a1a1aa] text-sm md:text-base max-w-2xl mx-auto font-light leading-relaxed"
                        >
                            Choose your Creative Power <span className="text-orange-500 text-xs md:text-sm"></span>
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="flex items-center justify-center gap-3 mt-4"
                        >
                            <span className={`text-xs font-semibold transition-colors ${!isAnnual ? 'text-white' : 'text-[#666]'}`}>
                                Monthly
                            </span>
                            <div
                                className={`relative w-12 h-6 rounded-full cursor-pointer transition-all shadow-[0_0_15px_rgba(255,107,0,0.3)] ${
                                    isAnnual
                                        ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                                        : 'bg-gradient-to-r from-gray-600 to-gray-500'
                                }`}
                                onClick={() => setIsAnnual(!isAnnual)}
                            >
                                <div
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                                        isAnnual ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                                ></div>
                            </div>
                            <div className="flex items-center gap-1.5 w-[110px]">
                                <span className={`text-xs font-semibold transition-colors ${isAnnual ? 'text-white' : 'text-[#666]'}`}>
                                    Annual
                                </span>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all duration-300 ${
                                        isAnnual
                                            ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400'
                                            : 'bg-transparent border border-[#444] text-[#555] line-through'
                                    }`}
                                >
                                    Save {Math.round(ANNUAL_DISCOUNT_PCT * 100)}%
                                </span>
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
                                            className={`relative h-full rounded-2xl p-5 flex flex-col transition-all duration-500 group transform-gpu backdrop-blur-xl ${
                                                plan.highlighted
                                                    ? 'bg-[#120a05]/40 border border-orange-500/40 shadow-[0_0_50px_rgba(255,107,0,0.15)] ring-1 ring-orange-500/20'
                                                    : 'bg-[#0a0a0a]/40 border border-[#1f1f1f] hover:border-[#333] hover:shadow-2xl hover:shadow-white/5'
                                            }`}
                                        >
                                            {plan.highlighted && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent rounded-2xl pointer-events-none" />
                                            )}

                                            <div className="mb-3 relative z-10">
                                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-orange-400 transition-colors uppercase tracking-tight">
                                                    {plan.name}
                                                </h3>
                                                <p className="text-[#888] text-xs leading-relaxed">{plan.description}</p>
                                            </div>

                                            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#333] to-transparent mb-4 relative z-10"></div>

                                            <div className="mb-4 relative z-10">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-white tracking-tighter">
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
                                                                        className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors"
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
                                                            {couponError && <p className="text-red-400 text-xs">{couponError}</p>}
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-green-400 text-sm font-semibold">{appliedCoupon.message}</p>
                                                                    {appliedCoupon.discountAmount > 0 && (
                                                                        <p className="text-green-400/80 text-xs mt-0.5">
                                                                            Discount: ${appliedCoupon.discountAmount / 100}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={handleRemoveCoupon}
                                                                    className="text-red-400 hover:text-red-300 text-xs font-semibold"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="w-full mb-4 relative z-10">
                                                {user ? (
                                                    <RazorpayCheckout
                                                        planType={planType}
                                                        billingPeriod={isAnnual ? 'annual' : 'monthly'}
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
                                                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 uppercase tracking-widest ${
                                                            plan.highlighted
                                                                ? 'bg-gradient-to-r from-[#ff6b00] to-[#ff4500] text-white hover:opacity-90 shadow-[0_0_30px_rgba(255,107,0,0.4)] border border-orange-500/50'
                                                                : 'bg-[#151515] text-white hover:bg-[#222] border border-[#2a2a2a] hover:border-[#444]'
                                                        }`}
                                                    >
                                                        {plan.cta}
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
                                                                className={`w-4 h-4 ${plan.highlighted ? 'text-orange-500' : 'text-white/80'}`}
                                                                strokeWidth={3}
                                                            />
                                                        </div>
                                                        <span className="text-[15px] leading-snug group-hover/item:text-white transition-colors text-[#a1a1aa]">
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
                                        className="relative rounded-2xl p-8 flex flex-col md:flex-row md:items-center gap-8 transition-all duration-500 group transform-gpu backdrop-blur-xl bg-[#0a0a0a]/40 border border-[#1f1f1f] hover:border-[#333] hover:shadow-2xl hover:shadow-white/5"
                                    >
                                        <div className="md:w-1/3 relative z-10">
                                            <h3 className="text-3xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors uppercase tracking-tight">
                                                {plan.name}
                                            </h3>
                                            <p className="text-[#888] text-sm leading-relaxed mb-4">{plan.description}</p>
                                        </div>

                                        <div className="hidden md:block w-px h-32 bg-gradient-to-b from-transparent via-[#333] to-transparent"></div>

                                        <div className="md:flex-1 relative z-10">
                                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {plan.features.map((feature, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-[#ccc] text-sm group/item">
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
                                                        <span className="leading-relaxed group-hover/item:text-white transition-colors">
                                                            {feature}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="md:w-48 relative z-10">
                                            <button
                                                onClick={() => setContactOpen(true)}
                                                className="w-full py-4 px-6 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-300 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98]"
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
