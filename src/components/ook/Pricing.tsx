'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import RazorpayCheckout from '@/components/payment/RazorpayCheckout';

interface PricingProps {
    user?: any;
}

const Pricing = ({ user }: PricingProps) => {
    const [isAnnual, setIsAnnual] = useState(true);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
    }, []);

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
        annualPrice: '₹5,099',
        monthlyPrice: '₹5,999',
        description: 'Perfect for getting started with AI-powered influencer content',
        features: [
            '50 AI Influencer Videos OR 30 minutes generation',
            'Unlimited custom avatar uploads',
            'Unlimited custom voice uploads',
            'Up to 50 thumbnail generations',
            'Custom logo & marquee overlay'
        ],
        notIncluded: [
            'Priority support',
            'High-volume generation'
        ],
        highlighted: false,
        cta: 'Get Plan',
    },
    {
        name: 'Pro',
        icon: Zap,
        annualPrice: '₹15,299',
        monthlyPrice: '₹17,999',
        description: 'For creators and brands scaling AI content production',
        features: [
            '180 AI Influencer Videos',
            '105 minutes generation time',
            'Unlimited custom avatar uploads',
            'Unlimited custom voice uploads',
            'Up to 180 thumbnail generations',
            'Custom logo & marquee overlay',
            '24/7 email support'
        ],
        notIncluded: [],
        highlighted: true,
        cta: 'Get Plan',
    },
   {
    name: 'Enterprise',
    icon: Crown,
    price: 'Custom',
    period: 'contact sales',
    description: 'For organizations scaling AI content with full control and collaboration',
    features: [
        'Everything in Pro',
        'Unlimited team seats',
        'Custom organization setup',
        'Admin access & controls',
        'Team management dashboard',
        'Content pipeline view',
        'Priority technical support'
    ],
    notIncluded: [],
    highlighted: false,
    cta: 'Contact Sales',
}
];
    return (
        <section id="pricing" data-section-theme="dark" className="relative py-24 bg-black font-sans selection:bg-orange-500/30 overflow-hidden">
            {/* Top Fade to blend with previous section seamlessly */}
            <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-black via-black/80 to-transparent z-10 pointer-events-none" />

            {/* Premium Background Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none mt-32">
                {/* Massive Glow Blobs for "Fill" */}
                <div className="absolute top-[20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-3xl transform-gpu" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-3xl transform-gpu" />
                
                {/* Mesh Gradients */}
                <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="xMidYMid slice">
                    <defs>
                        <radialGradient id="price-mesh-1" cx="20%" cy="60%" r="50%">
                            <stop offset="0%" stopColor="#FF6600" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="transparent" />
                        </radialGradient>
                        <radialGradient id="price-mesh-2" cx="80%" cy="80%" r="50%">
                            <stop offset="0%" stopColor="#8F00FF" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="transparent" />
                        </radialGradient>
                        <radialGradient id="price-mesh-3" cx="50%" cy="70%" r="60%">
                            <stop offset="0%" stopColor="#FF00D6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="transparent" />
                        </radialGradient>
                        
                        {/* Technical Grid Pattern with larger spacing */}
                        <pattern id="pricing-grid" width="80" height="80" patternUnits="userSpaceOnUse">
                            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="0.5"/>
                            <circle cx="0" cy="0" r="1.5" fill="white" fillOpacity="0.1" />
                        </pattern>
                    </defs>
                    
                    <rect width="100%" height="100%" fill="url(#price-mesh-1)" />
                    <rect width="100%" height="100%" fill="url(#price-mesh-2)" />
                    <rect width="100%" height="100%" fill="url(#price-mesh-3)" />
                    <rect width="100%" height="100%" fill="url(#pricing-grid)" />
                </svg>

                {/* Animated Floating Embers (Only if mounted to avoid hydration error) */}
                {mounted && [...Array(10)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-[2px] h-[2px] bg-orange-400 rounded-full blur-[1px]"
                        initial={{ 
                            x: Math.random() * 100 + '%', 
                            y: Math.random() * 100 + '%',
                            opacity: 0,
                            scale: 0
                        }}
                        animate={{ 
                            y: [null, '-30%'],
                            opacity: [0, 0.8, 0],
                            scale: [0, 1.5, 0],
                            x: [null, (Math.random() - 0.5) * 60 + 'px']
                        }}
                        transition={{ 
                            duration: Math.random() * 15 + 10,
                            repeat: Infinity,
                            delay: Math.random() * 5,
                            ease: "easeInOut"
                        }}
                    />
                ))}
                
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Section Header */}
                <div className="text-center mb-16">
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
                        className="text-[#a1a1aa] text-xl md:text-2xl max-w-2xl mx-auto font-light leading-relaxed"
                    >
                        Choose your Creative Power
                    </motion.p>

                    {/* Centralized Toggle Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center justify-center gap-3 mt-8"
                    >
                        <span className={`text-xs font-semibold transition-colors ${
                            !isAnnual ? 'text-white' : 'text-[#666]'
                        }`}>
                            Monthly
                        </span>
                        <div 
                            className="relative w-12 h-6 rounded-full cursor-pointer transition-all bg-gradient-to-r from-orange-400 to-orange-500 shadow-[0_0_15px_rgba(255,107,0,0.3)]"
                            onClick={() => setIsAnnual(!isAnnual)}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                                isAnnual ? 'translate-x-7' : 'translate-x-1'
                            }`}></div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-semibold transition-colors ${
                                isAnnual ? 'text-white' : 'text-[#666]'
                            }`}>
                                Annual
                            </span>
                            {isAnnual && (
                                <span className="px-1.5 py-0.5 bg-orange-500/20 border border-orange-500/40 rounded-full text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                                    15% Off
                                </span>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-8 max-w-[1100px] mx-auto">
                    {plans.map((plan, index) => {
                        return (
                            <motion.div
                                key={plan.name}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className={`relative h-full rounded-none p-8 flex flex-col transition-all duration-500 group transform-gpu ${
                                    plan.highlighted
                                        ? 'bg-[#120a05]/70 border border-orange-500/40 shadow-[0_0_50px_rgba(255,107,0,0.15)] ring-1 ring-orange-500/20'
                                        : 'bg-[#0a0a0a]/90 border border-[#1f1f1f] hover:border-[#333] hover:shadow-2xl hover:shadow-white/5'
                                }`}
                            >
                                {/* Inner Glow for Pro Card */}
                                {plan.highlighted && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent rounded-none pointer-events-none" />
                                )}

                                {/* Header Section */}
                                <div className="mb-6 relative z-10">
                                    <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-orange-400 transition-colors uppercase tracking-tight">{plan.name}</h3>
                                    <p className="text-[#888] text-sm leading-relaxed">{plan.description}</p>
                                </div>

                                <div className="h-px w-full bg-gradient-to-r from-transparent via-[#333] to-transparent mb-6 relative z-10"></div>

                                {/* Price Section */}
                                <div className="mb-6 flex items-baseline gap-2 relative z-10">
                                    <span className="text-5xl font-black text-white tracking-tighter">
                                        {plan.name === 'Enterprise' ? plan.price : (isAnnual ? plan.annualPrice : plan.monthlyPrice)}
                                    </span>
                                    {plan.period !== 'contact sales' && (
                                        <span className="text-[#888] text-sm font-medium tracking-tight uppercase">
                                            {plan.name === 'Enterprise' ? plan.period : 'per month'}
                                        </span>
                                    )}
                                </div>

                                <div className="h-px w-full bg-gradient-to-r from-transparent via-[#333] to-transparent mb-6 relative z-10"></div>

                                {/* Features Section */}
                                <div className="flex-1 space-y-4 mb-10 relative z-10">
                                    {plan.name === 'Pro' && (
                                        <p className="text-orange-500/80 text-xs mb-4 font-bold uppercase tracking-widest">Everything from Hobby, plus:</p>
                                    )}
                                    {plan.name === 'Enterprise' && (
                                        <p className="text-orange-500/80 text-xs mb-4 font-bold uppercase tracking-widest">Everything from Pro, plus:</p>
                                    )}
                                    
                                    {plan.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-4 group/item">
                                            <div className="mt-1 flex-shrink-0 transition-transform group-hover/item:rotate-12">
                                                <Check className={`w-4 h-4 ${plan.highlighted ? 'text-orange-500' : 'text-white/80'}`} strokeWidth={3} />
                                            </div>
                                            <span className="text-[#a1a1aa] text-[15px] leading-snug group-hover/item:text-white transition-colors">{feature}</span>
                                        </div>
                                    ))}
                                    {plan.notIncluded.length > 0 && plan.notIncluded.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-4 opacity-30">
                                            <div className="mt-1 w-4 h-4 flex items-center justify-center flex-shrink-0">
                                                <div className="w-2.5 h-[2px] bg-[#a1a1aa] rounded-full" />
                                            </div>
                                            <span className="text-[#a1a1aa] text-[15px] leading-snug line-through">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Button Section */}
                                <div className="w-full mt-auto relative z-10">
                                    {plan.name === 'Hobby' ? (
                                        user ? (
                                            <RazorpayCheckout
                                                planType="hobby"
                                                billingPeriod={isAnnual ? 'annual' : 'monthly'}
                                                onSuccess={(subscriptionId) => {
                                                    console.log('Subscription successful:', subscriptionId);
                                                    router.push('/workspace');
                                                }}
                                                onError={(error) => {
                                                    console.error('Subscription error:', error);
                                                    alert(`Subscription failed: ${error}`);
                                                }}
                                            />
                                        ) : (
                                            <button 
                                                onClick={() => handlePlanClick('Hobby')}
                                                className="w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 bg-[#151515] text-white hover:bg-[#222] border border-[#2a2a2a] hover:border-[#444] uppercase tracking-widest"
                                            >
                                                {plan.cta}
                                            </button>
                                        )
                                    ) : plan.name === 'Pro' ? (
                                        user ? (
                                            <RazorpayCheckout
                                                planType="pro"
                                                billingPeriod={isAnnual ? 'annual' : 'monthly'}
                                                onSuccess={(subscriptionId) => {
                                                    console.log('Subscription successful:', subscriptionId);
                                                    router.push('/workspace');
                                                }}
                                                onError={(error) => {
                                                    console.error('Subscription error:', error);
                                                    alert(`Subscription failed: ${error}`);
                                                }}
                                            />
                                        ) : (
                                            <button 
                                                onClick={() => handlePlanClick('Pro')}
                                                className="w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 bg-gradient-to-r from-[#ff6b00] to-[#ff4500] text-white hover:opacity-90 shadow-[0_0_30px_rgba(255,107,0,0.4)] border border-orange-500/50 transform group-hover:scale-[1.05] uppercase tracking-widest"
                                            >
                                                {plan.cta}
                                            </button>
                                        )
                                    ) : (
                                        <button 
                                            onClick={() => handlePlanClick('Enterprise')}
                                            className="w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 bg-[#151515] text-white hover:bg-[#222] border border-[#2a2a2a] hover:border-[#444] uppercase tracking-widest"
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
