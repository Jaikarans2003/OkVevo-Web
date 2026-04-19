"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { updateUserType } from '../../services/userService';
import { Users, ArrowRight, Loader2, Crown } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function OnboardingPage() {
    const router = useRouter();

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState(false);

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

    const handleSingleUser = async () => {
        if (!user) return;

        setSelecting(true);
        try {
            await updateUserType(user.uid, 'single');
            router.push('/onboarding/intro');
        } catch (error) {
            console.error('Error updating user type:', error);
            alert('Failed to update user type. Please try again.');
        } finally {
            setSelecting(false);
        }
    };

    const handlePro = () => {
        router.push('/onboarding/pricing?next=pro');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">

            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-accent-orange/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute top-2/3 -left-24 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '800ms' }} />
                <div className="absolute -bottom-16 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1400ms' }} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,102,0,0.16),transparent_48%)]" />
            </div>

            <div className="relative z-10 w-full max-w-6xl">
                {/* Logo & Welcome */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-10 md:mb-12"
                >
                    <Link href="/" className="inline-block mb-6">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={80}
                            height={80}
                            className="w-20 h-20 hover:scale-110 transition-transform"
                        />
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-accent-orange">
                        Welcome
                    </h1>
                    <p className="text-base md:text-xl text-white/70">
                        Let's get you set up.
                    </p>
                </motion.div>

                {/* User Type Selection Cards */}
                <div className="grid md:grid-cols-2 gap-5 md:gap-7 max-w-4xl mx-auto w-full">
                    {/* Single User Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        onClick={handleSingleUser}
                        disabled={selecting}
                        className="group relative rounded-3xl p-6 md:p-8 border border-accent-orange/25 bg-white/[0.04] backdrop-blur-xl hover:border-accent-orange/80 hover:bg-white/[0.07] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed text-left shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
                    >
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Users className="w-12 h-12 text-white" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                    Single User
                                </h3>
                                <p className="text-white/70 leading-relaxed mb-4">
                                    Perfect for individual creators, freelancers, and solo content makers.
                                </p>
                                <ul className="text-sm text-white/60 space-y-2 text-left">
                                    <li>• Personal workspace</li>
                                    <li>• Individual project management</li>
                                    <li>• Full creative control</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                Continue as Single User
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </motion.button>

                    {/* Pro Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        onClick={handlePro}
                        disabled={selecting}
                        className="group relative rounded-3xl p-6 md:p-8 border border-accent-orange/25 bg-white/[0.04] backdrop-blur-xl hover:border-accent-orange/80 hover:bg-white/[0.07] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed text-left shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
                    >
                        <div className="absolute top-4 right-4 bg-gradient-to-r from-accent-orange to-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                            Pro
                        </div>

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Crown className="w-12 h-12 text-white" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-accent-orange">
                                    Pro (5 Seats)
                                </h3>
                                <p className="text-white/70 leading-relaxed mb-4">
                                    Small team collaboration with up to 5 members. All features included.
                                </p>
                                <ul className="text-sm text-white/60 space-y-2 text-left">
                                    <li>• Up to 5 team members</li>
                                    <li>• All functionalities</li>
                                    <li>• Works with any email</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-accent-orange font-bold group-hover:gap-4 transition-all">
                                Continue as Pro
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </motion.button>
                </div>

                {/* Info Note */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-8 text-center text-sm text-white/55"
                >
                    You can change this later in your profile settings
                </motion.div>
            </div>

            {selecting && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
                </div>
            )}
        </div>
    );
}
