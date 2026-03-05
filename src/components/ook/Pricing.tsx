'use client';

import { motion } from 'framer-motion';
import { Check, Zap, Crown, Sparkles } from 'lucide-react';
import Image from 'next/image';

const Pricing = () => {
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
            gradient: 'from-zinc-900 to-zinc-950'
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
            gradient: 'from-accent-orange to-orange-600'
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
            gradient: 'from-zinc-900 to-zinc-950'
        }
    ];

    return (
        <section id="pricing" data-section-theme="light" className="relative py-20 overflow-hidden">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                {/* <Image
                    src="/OKVEVO With BackGrounds/BackGrounds (14).png"
                    alt="Pricing Background"
                    fill
                    className="object-cover"
                    priority
                /> */}
                {/* Dark overlay for content readability */}
            </div>
            
            {/* Background Elements */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-orange/5 to-transparent" />
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent-orange/10 rounded-full blur-[60px] animate-pulse transform-gpu" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-orange-400/10 rounded-full blur-[60px] animate-pulse transform-gpu" style={{ animationDelay: '1s' }} />

            <div className="centering-container relative z-10">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="inline-block mb-6"
                    >
                        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass-card border-2 border-accent-orange/30">
                            {/* <Sparkles className="w-4 h-4 text-accent-orange" /> */}
                            <span className="text-xs font-bold tracking-[0.2em] uppercase text-text-main">Pricing</span>
                        </div>
                    </motion.div>

                    <h2 className="text-4xl md:text-5xl font-black mb-6 text-text-main tracking-tight">
                        Choose Your Creative Power
                    </h2>
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {plans.map((plan, index) => {
                        const Icon = plan.icon;
                        return (
                            <motion.div
                                key={plan.name}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-50px' }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="relative group"
                            >
                                {/* Highlighted Badge */}
                                {plan.highlighted && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.3 }}
                                        className="absolute -top-4 left-1/2 -translate-x-1/2 z-10"
                                    >
                                        <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-accent-orange to-orange-600 text-white text-xs font-bold tracking-wider uppercase shadow-lg">
                                            Most Popular
                                        </div>
                                    </motion.div>
                                )}

                                {/* Card */}
                                <div className={`relative h-full rounded-3xl p-6 transition-all duration-700 transform-gpu ${plan.highlighted
                                    ? 'glass-card border-2 border-accent-orange shadow-2xl shadow-accent-orange/20 md:scale-105'
                                    : 'glass-card border border-white/5 hover:border-accent-orange/50 hover:shadow-xl'
                                    }`}>
                                    {/* Icon */}
                                    <div className={`inline-flex p-3 rounded-xl mb-4 bg-gradient-to-br ${plan.gradient}`}>
                                        <Icon className={plan.highlighted ? 'text-white' : 'text-text-main'} />
                                    </div>

                                    {/* Plan Name */}
                                    <h3 className="text-2xl font-black mb-2 text-text-main">{plan.name}</h3>

                                    {/* Description */}
                                    <p className="text-text-dim mb-6 text-xs leading-relaxed">{plan.description}</p>

                                    {/* Price */}
                                    <div className="mb-6">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-4xl font-black text-text-main">{plan.price}</span>
                                            {plan.period !== 'contact sales' && (
                                                <span className="text-text-dim text-base">/{plan.period.split(' ')[1] || plan.period}</span>
                                            )}
                                        </div>
                                        <p className="text-text-dim text-xs">{plan.period}</p>
                                    </div>

                                    {/* CTA Button */}
                                    <button className={`w-full py-3.5 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-300 mb-6 ${plan.highlighted
                                        ? 'bg-gradient-to-r from-accent-orange to-orange-600 text-white hover:shadow-xl hover:shadow-accent-orange/40 hover:scale-105'
                                        : 'bg-text-main text-bg-main hover:bg-accent-orange hover:text-white hover:shadow-lg'
                                        }`}>
                                        {plan.cta}
                                    </button>

                                    {/* Features List */}
                                    <div className="space-y-3">
                                        <p className="text-xs font-bold tracking-[0.15em] uppercase text-text-dim mb-3">What's Included</p>
                                        {plan.features.map((feature, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: 0.05 * i }}
                                                className="flex items-start gap-2"
                                            >
                                                <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${plan.highlighted ? 'bg-accent-orange' : 'bg-text-main'
                                                    }`}>
                                                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                                </div>
                                                <span className="text-text-main text-xs leading-relaxed">{feature}</span>
                                            </motion.div>
                                        ))}

                                        {/* Not Included (only for Free plan) */}
                                        {plan.notIncluded.length > 0 && (
                                            <div className="pt-4 mt-4 border-t border-white/5 space-y-2.5">
                                                {plan.notIncluded.map((feature, i) => (
                                                    <div key={i} className="flex items-start gap-2 opacity-40">
                                                        <div className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center bg-gray-300 mt-0.5">
                                                            <div className="w-1.5 h-0.5 bg-white" />
                                                        </div>
                                                        <span className="text-text-dim text-xs leading-relaxed line-through">{feature}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Bottom CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="text-center mt-16"
                >
                    <button className="px-8 py-3 rounded-full border-2 border-text-main/10 text-text-main font-bold text-xs tracking-wider uppercase hover:bg-text-main hover:text-bg-main transition-all duration-300">
                        Start free.
                    </button>
                    {/* <p className="text-text-dim text-base mb-4">
                        Not sure which plan is right for you?
                    </p>
                    <button className="px-8 py-3 rounded-full border-2 border-text-main/10 text-text-main font-bold text-xs tracking-wider uppercase hover:bg-text-main hover:text-bg-main transition-all duration-300">
                        Compare All Features
                    </button> */}
                </motion.div>
            </div>
        </section >
    );
};

export default Pricing;
