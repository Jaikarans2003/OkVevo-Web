'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';
import RazorpayCheckout from '@/components/payment/RazorpayCheckout';
import { useRouter } from 'next/navigation';

interface PricingProps {
    user?: any;
}

const Pricing = ({ user }: PricingProps) => {
    const [isAnnual, setIsAnnual] = useState(true);
    const router = useRouter();

    const handlePlanClick = (planName: string) => {
        if (!user) {
            // Store the intended plan in sessionStorage to redirect after login
            sessionStorage.setItem('returnToPlan', planName.toLowerCase());
            router.push('/login');
        }
        // If user is logged in, the payment component will handle it
    };

    const plans = [
        {
            name: 'Hobby',
            icon: Sparkles,
            price: '₹4,999',
            period: 'per month',
            description: 'Perfect for getting started with AI-powered creativity',
            features: [
                '10 generations per month',
                'Basic prompts library',
                'Standard quality outputs',
                'Community support',
                'Watermarked exports'
            ],
            notIncluded: [
                'Advanced AI models',
                'Priority processing',
                'Commercial license'
            ],
            highlighted: false,
            cta: 'Get Started',
        },
        {
            name: 'Pro',
            icon: Zap,
            price: '₹13,999',
            period: 'per month',
            description: 'For creators who want unlimited possibilities',
            features: [
                'Unlimited generations',
                'Advanced prompts library',
                'Premium quality outputs',
                'Priority support',
                'No watermarks',
                'Commercial license',
                'Advanced AI models',
                'Priority processing'
            ],
            notIncluded: [],
            highlighted: true,
            cta: 'Start Pro Trial',
        },
        {
            name: 'Enterprise',
            icon: Crown,
            price: 'Custom',
            period: 'contact sales',
            description: 'For organizations with custom needs',
            features: [
                'Everything in Pro',
                'Dedicated account manager',
                'Custom AI model training',
                'API access',
                'Team collaboration tools',
                'Advanced analytics',
                'SLA guarantees',
                'White-label options'
            ],
            notIncluded: [],
            highlighted: false,
            cta: 'Contact Sales',
        }
    ];

    return (
        <section id="pricing" data-section-theme="dark" className="relative py-24 bg-black font-sans selection:bg-orange-500/30">
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-5xl md:text-6xl font-semibold mb-6 text-white tracking-tight">
                        Pricing
                    </h2>
                    <p className="text-[#a1a1aa] text-xl max-w-2xl mx-auto font-light leading-relaxed">
                        Design for free. Upgrade to unlock more.
                    </p>
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
                    {plans.map((plan, index) => {
                        return (
                            <motion.div
                                key={plan.name}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className={`relative h-full rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                                    plan.highlighted
                                        ? 'bg-[#120a05] border border-orange-500/20 shadow-2xl shadow-orange-500/5'
                                        : 'bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#333]'
                                }`}
                            >
                                {/* Header Section */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="pr-4">
                                        <h3 className="text-2xl font-medium text-white mb-1">{plan.name}</h3>
                                        <p className="text-[#888] text-sm leading-relaxed">{plan.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] text-[#666] font-bold tracking-widest uppercase">
                                            {plan.name === 'Enterprise' ? 'Annual Only' : 'Annual'}
                                        </span>
                                        {plan.name !== 'Enterprise' && (
                                            <div 
                                                className={`w-8 h-4 rounded-full flex items-center px-[2px] cursor-pointer transition-colors ${plan.highlighted ? 'bg-gradient-to-r from-orange-400 to-orange-500' : 'bg-gradient-to-r from-orange-500 to-orange-400'}`}
                                                onClick={() => setIsAnnual(!isAnnual)}
                                            >
                                                <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${isAnnual ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="h-px w-full bg-[#1f1f1f] mb-6"></div>

                                {/* Price Section */}
                                <div className="mb-6 flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-white tracking-tight">{plan.price}</span>
                                    {plan.period !== 'contact sales' && (
                                        <span className="text-[#888] text-sm font-medium">{plan.period}</span>
                                    )}
                                </div>

                                <div className="h-px w-full bg-[#1f1f1f] mb-6"></div>

                                {/* Features Section */}
                                <div className="flex-1 space-y-4 mb-8">
                                    {plan.name === 'Pro' && (
                                        <p className="text-[#a1a1aa] text-sm mb-4">Everything from Hobby, plus:</p>
                                    )}
                                    {plan.name === 'Enterprise' && (
                                        <p className="text-[#a1a1aa] text-sm mb-4">Everything from Pro, plus:</p>
                                    )}
                                    
                                    {plan.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <div className="mt-1 flex-shrink-0">
                                                <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />
                                            </div>
                                            <span className="text-[#a1a1aa] text-sm leading-snug">{feature}</span>
                                        </div>
                                    ))}
                                    {plan.notIncluded.length > 0 && plan.notIncluded.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3 opacity-40">
                                            <div className="mt-1 w-[14px] h-[14px] flex items-center justify-center flex-shrink-0">
                                                <div className="w-2.5 h-[2px] bg-[#a1a1aa] rounded-full" />
                                            </div>
                                            <span className="text-[#a1a1aa] text-sm leading-snug line-through">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Button Section */}
                                <div className="w-full mt-auto">
                                    {plan.name === 'Hobby' ? (
                                        <div className="w-full text-center">
                                            {user ? (
                                                <RazorpayCheckout
                                                    planType="hobby"
                                                    onSuccess={(subscriptionId) => {
                                                        console.log('Payment successful:', subscriptionId);
                                                        router.push('/workspace');
                                                    }}
                                                    onError={(error) => {
                                                        console.error('Payment error:', error);
                                                        alert(`Payment failed: ${error}`);
                                                    }}
                                                />
                                            ) : (
                                                <button 
                                                    onClick={() => handlePlanClick('Hobby')}
                                                    className="w-full py-[14px] rounded-[14px] font-medium text-[15px] transition-all duration-300 bg-[#151515] text-white hover:bg-[#222] border border-[#2a2a2a]"
                                                >
                                                    {plan.cta}
                                                </button>
                                            )}
                                        </div>
                                    ) : plan.name === 'Pro' ? (
                                        <div className="w-full text-center">
                                            {user ? (
                                                <RazorpayCheckout
                                                    planType="pro"
                                                    onSuccess={(subscriptionId) => {
                                                        console.log('Payment successful:', subscriptionId);
                                                        router.push('/workspace');
                                                    }}
                                                    onError={(error) => {
                                                        console.error('Payment error:', error);
                                                        alert(`Payment failed: ${error}`);
                                                    }}
                                                />
                                            ) : (
                                                <button 
                                                    onClick={() => handlePlanClick('Pro')}
                                                    className="w-full py-[14px] rounded-[14px] font-semibold text-[15px] transition-all duration-300 bg-gradient-to-r from-[#ff6b00] to-[#ff4500] text-white hover:opacity-90 shadow-[0_0_20px_rgba(255,107,0,0.3)] border border-orange-500/50"
                                                >
                                                    {plan.cta}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handlePlanClick('Enterprise')}
                                            className="w-full py-[14px] rounded-[14px] font-medium text-[15px] transition-all duration-300 bg-[#151515] text-white hover:bg-[#222] border border-[#2a2a2a]"
                                        >
                                            {plan.cta}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default Pricing;
