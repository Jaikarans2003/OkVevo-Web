"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { updateUserType, isCustomDomain } from '../../services/userService';
import { Users, Building2, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function OnboardingPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState(false);
    const [canFormOrganisation, setCanFormOrganisation] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push('/login');
            } else {
                setUser(currentUser);
                setCanFormOrganisation(isCustomDomain(currentUser.email || ''));
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
            router.push('/profile');
        } catch (error) {
            console.error('Error updating user type:', error);
            alert('Failed to update user type. Please try again.');
        } finally {
            setSelecting(false);
        }
    };

    const handleOrganisation = () => {
        router.push('/onboarding/organisation');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-custom-bg flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-custom-orange animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-custom-bg text-custom-cream flex flex-col items-center justify-center p-6">
            {/* Background Animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-custom-orange/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 w-full max-w-4xl">
                {/* Logo */}
                <div className="text-center mb-12">
                    <Link href="/" className="inline-block mb-6">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={80}
                            height={80}
                            className="w-20 h-20 hover:scale-110 transition-transform"
                        />
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-custom-orange">
                        Welcome to OKVEVO!
                    </h1>
                    <p className="text-xl text-custom-cream/70">
                        Let's get you set up. How will you be using OKVEVO?
                    </p>
                </div>

                {/* User Type Selection Cards */}
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Single User Card */}
                    <button
                        onClick={handleSingleUser}
                        disabled={selecting}
                        className="group relative bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-custom-orange to-orange-600 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Users className="w-12 h-12 text-custom-cream" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-custom-orange">
                                    Single User
                                </h3>
                                <p className="text-custom-cream/70 leading-relaxed mb-4">
                                    Perfect for individual creators, freelancers, and solo content makers.
                                </p>
                                <ul className="text-sm text-custom-cream/60 space-y-2 text-left">
                                    <li>• Personal workspace</li>
                                    <li>• Individual project management</li>
                                    <li>• Full creative control</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-custom-orange font-bold group-hover:gap-4 transition-all">
                                Continue as Single User
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </button>

                    {/* Organisation Card */}
                    <button
                        onClick={handleOrganisation}
                        disabled={selecting}
                        className="group relative bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                        {!canFormOrganisation && (
                            <div className="absolute top-4 right-4 bg-orange-500/20 text-custom-orange text-xs font-bold px-3 py-1 rounded-full border border-custom-orange/50">
                                Join Only
                            </div>
                        )}

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-orange-600 to-custom-orange rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Building2 className="w-12 h-12 text-custom-cream" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-custom-orange">
                                    Organisation
                                </h3>
                                <p className="text-custom-cream/70 leading-relaxed mb-4">
                                    Collaborate with your team, manage projects together, and scale your content creation.
                                </p>
                                <ul className="text-sm text-custom-cream/60 space-y-2 text-left">
                                    <li>• Team collaboration</li>
                                    <li>• Shared workspace</li>
                                    <li>• Admin dashboard</li>
                                    {!canFormOrganisation && (
                                        <li className="text-orange-400">• Custom domain required to form</li>
                                    )}
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-custom-orange font-bold group-hover:gap-4 transition-all">
                                Continue as Organisation
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </button>
                </div>

                {/* Info Note */}
                <div className="mt-8 text-center text-sm text-custom-cream/50">
                    You can change this later in your profile settings
                </div>
            </div>

            {selecting && (
                <div className="fixed inset-0 bg-custom-bg/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <Loader2 className="w-12 h-12 text-custom-orange animate-spin" />
                </div>
            )}
        </div>
    );
}
