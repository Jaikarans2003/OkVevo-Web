"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import { isCustomDomain } from '../../../services/userService';
import { UserPlus, Building, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function OrganisationOptionsPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
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
                {/* Back Button */}
                <Link
                    href="/onboarding"
                    className="inline-flex items-center gap-2 text-custom-cream/70 hover:text-custom-orange transition-colors mb-8"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to User Type Selection
                </Link>

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
                        Organisation Setup
                    </h1>
                    <p className="text-xl text-custom-cream/70">
                        Choose how you'd like to proceed
                    </p>
                    {user?.email && (
                        <p className="text-sm text-custom-cream/50 mt-2">
                            Logged in as: {user.email}
                        </p>
                    )}
                </div>

                {/* Organisation Options Cards */}
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Join Organisation Card */}
                    <Link
                        href="/onboarding/organisation/join"
                        className="group relative bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 text-left block"
                    >
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-custom-orange to-orange-600 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <UserPlus className="w-12 h-12 text-custom-cream" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-custom-orange">
                                    Join an Existing Organisation
                                </h3>
                                <p className="text-custom-cream/70 leading-relaxed mb-4">
                                    Enter an organisation code to join your team's workspace.
                                </p>
                                <ul className="text-sm text-custom-cream/60 space-y-2 text-left">
                                    <li>• Quick setup with organisation code</li>
                                    <li>• Access shared projects</li>
                                    <li>• Collaborate with team members</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-custom-orange font-bold group-hover:gap-4 transition-all">
                                Join Organisation
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                    </Link>

                    {/* Form Organisation Card */}
                    <div className="relative">
                        {canFormOrganisation ? (
                            <Link
                                href="/onboarding/organisation/form"
                                className="group relative bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 text-left block"
                            >
                                <div className="flex flex-col items-center text-center space-y-6">
                                    <div className="p-6 bg-gradient-to-br from-orange-600 to-custom-orange rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                        <Building className="w-12 h-12 text-custom-cream" />
                                    </div>

                                    <div>
                                        <h3 className="text-2xl font-bold mb-3 text-custom-orange">
                                            Form an Organisation
                                        </h3>
                                        <p className="text-custom-cream/70 leading-relaxed mb-4">
                                            Create a new organisation and become the admin.
                                        </p>
                                        <ul className="text-sm text-custom-cream/60 space-y-2 text-left">
                                            <li>• Full admin control</li>
                                            <li>• Invite team members</li>
                                            <li>• Manage organisation settings</li>
                                        </ul>
                                    </div>

                                    <div className="flex items-center gap-2 text-custom-orange font-bold group-hover:gap-4 transition-all">
                                        Create Organisation
                                        <ArrowRight className="w-5 h-5" />
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            <div className="relative bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/20 rounded-3xl p-8 opacity-60 cursor-not-allowed text-left">
                                <div className="absolute top-4 right-4 bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full border border-red-500/50">
                                    Custom Domain Required
                                </div>

                                <div className="flex flex-col items-center text-center space-y-6">
                                    <div className="p-6 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl shadow-lg">
                                        <Building className="w-12 h-12 text-custom-cream" />
                                    </div>

                                    <div>
                                        <h3 className="text-2xl font-bold mb-3 text-custom-cream/50">
                                            Form an Organisation
                                        </h3>
                                        <p className="text-custom-cream/50 leading-relaxed mb-4">
                                            To create an organisation, you need to sign in with a custom domain email (not Gmail, Yahoo, etc.).
                                        </p>
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-4">
                                            <p className="text-sm text-red-400">
                                                Your current email ({user?.email}) uses a common email provider. Please sign in with your organisation's email address to create an organisation.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
