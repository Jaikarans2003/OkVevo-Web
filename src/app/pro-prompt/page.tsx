"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { markProPromptShown } from '../../services/userService';
import { Crown, Users, Sparkles, ArrowRight, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import NoiseOverlay from '../../components/NoiseOverlay';

export default function ProPromptPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push('/login');
            } else {
                setUser(currentUser);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleUpgradeToPro = () => {
        router.push('/onboarding/pro');
    };

    const handleSkip = async () => {
        if (!user) return;

        setProcessing(true);
        try {
            await markProPromptShown(user.uid);
            router.push('/profile');
        } catch (error) {
            console.error('Error marking Pro prompt as shown:', error);
            router.push('/profile');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg-main text-text-main flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <NoiseOverlay />

            {/* Background Decorative Gradients */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2], x: [0, 50, 0] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent-orange rounded-full blur-[150px]"
                />
                <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.25, 0.15], x: [0, -40, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-accent-orange rounded-full blur-[150px]"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-4xl"
            >
                {/* Skip Button */}
                <button
                    onClick={handleSkip}
                    disabled={processing}
                    className="absolute -top-4 right-0 p-2 text-text-dim hover:text-text-main transition-colors disabled:opacity-50 hover:scale-110 transition-transform"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block mb-6 group">
                        <Image
                            src="/OKVEVO Logos WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={60}
                            height={60}
                            className="w-16 h-16 hover:scale-110 transition-transform"
                        />
                    </Link>
                </div>

                {/* Pro Badge */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex justify-center mb-8"
                >
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-accent-orange to-orange-600 px-8 py-3 rounded-full shadow-lg">
                        <Crown className="w-6 h-6 text-white" />
                        <span className="text-white font-black text-xl tracking-tight">OKVEVO Pro</span>
                    </div>
                </motion.div>

                {/* Main Content */}
                <div className="glass-card p-12 rounded-[48px] border border-text-main/10">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-5xl md:text-6xl font-bold mb-4 text-center tracking-tight"
                    >
                        Unlock <span className="text-accent-orange">Pro</span> Features
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-xl text-text-dim text-center mb-12"
                    >
                        Collaborate with your team in a Pro organization
                    </motion.p>

                    {/* Features Grid */}
                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        {[
                            {
                                icon: Users,
                                title: "5-Seat Team",
                                description: "Collaborate with up to 5 team members",
                                delay: 0.5
                            },
                            {
                                icon: Sparkles,
                                title: "Full Features",
                                description: "Access all OKVEVO functionalities",
                                delay: 0.6
                            },
                            {
                                icon: Crown,
                                title: "No Restrictions",
                                description: "Works with any email address",
                                delay: 0.7
                            }
                        ].map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: feature.delay }}
                                className="text-center p-8 bg-white rounded-[32px] border-2 border-text-main/5 hover:border-accent-orange/20 transition-all duration-500 group hover:shadow-lg"
                            >
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl mb-5 group-hover:scale-110 transition-transform duration-500">
                                    <feature.icon className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-lg font-bold text-text-main mb-3">{feature.title}</h3>
                                <p className="text-sm text-text-dim leading-relaxed">
                                    {feature.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="space-y-4"
                    >
                        <button
                            onClick={handleUpgradeToPro}
                            disabled={processing}
                            className="w-full bg-gradient-to-r from-accent-orange to-orange-600 hover:from-orange-600 hover:to-accent-orange text-white font-bold py-5 rounded-2xl transition-all duration-500 transform hover:scale-[1.02] hover:shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            <Crown className="w-5 h-5" />
                            Upgrade to Pro
                            <ArrowRight className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={processing}
                            className="w-full bg-white hover:bg-text-main/5 border-2 border-text-main/10 hover:border-accent-orange/30 text-text-dim hover:text-text-main font-medium py-5 rounded-2xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            ) : (
                                'Continue without Pro'
                            )}
                        </button>
                    </motion.div>
                </div>

                {/* Info Note */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-8 text-center text-sm text-text-dim"
                >
                    You can upgrade to Pro anytime from your profile settings
                </motion.div>
            </motion.div>
        </div>
    );
}
