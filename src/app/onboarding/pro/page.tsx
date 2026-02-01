"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProOnboardingPage() {
    const router = useRouter();
    const [selecting, setSelecting] = useState(false);

    const handleCreatePro = () => {
        router.push('/onboarding/pro/create');
    };

    const handleJoinPro = () => {
        router.push('/onboarding/pro/join');
    };

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
                    className="inline-flex items-center gap-2 text-custom-cream/60 hover:text-custom-cream transition-colors mb-8"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to options
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
                        OKVEVO Pro
                    </h1>
                    <p className="text-xl text-custom-cream/70">
                        Create or join a Pro organization (max 5 members)
                    </p>
                </div>

                {/* Options Cards */}
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Create Pro Organisation Card */}
                    <button
                        onClick={handleCreatePro}
                        disabled={selecting}
                        className="group relative bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-custom-orange to-orange-600 rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Building2 className="w-12 h-12 text-custom-cream" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-custom-orange">
                                    Create Pro Organisation
                                </h3>
                                <p className="text-custom-cream/70 leading-relaxed mb-4">
                                    Start your own Pro organization and invite up to 4 team members to join you.
                                </p>
                                <ul className="text-sm text-custom-cream/60 space-y-2 text-left">
                                    <li>• You'll be the admin</li>
                                    <li>• Invite up to 4 members</li>
                                    <li>• Full control over team</li>
                                    <li>• Works with any email</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-custom-orange font-bold group-hover:gap-4 transition-all">
                                Create New Pro Org
                                <ArrowLeft className="w-5 h-5 rotate-180" />
                            </div>
                        </div>
                    </button>

                    {/* Join Pro Organisation Card */}
                    <button
                        onClick={handleJoinPro}
                        disabled={selecting}
                        className="group relative bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-6 bg-gradient-to-br from-orange-600 to-custom-orange rounded-2xl shadow-lg group-hover:shadow-2xl transition-shadow duration-500">
                                <Users className="w-12 h-12 text-custom-cream" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-custom-orange">
                                    Join Pro Organisation
                                </h3>
                                <p className="text-custom-cream/70 leading-relaxed mb-4">
                                    Join an existing Pro organization using an organization ID provided by your admin.
                                </p>
                                <ul className="text-sm text-custom-cream/60 space-y-2 text-left">
                                    <li>• Need organization ID</li>
                                    <li>• Join existing team</li>
                                    <li>• Collaborate instantly</li>
                                    <li>• Subject to 5-member limit</li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-2 text-custom-orange font-bold group-hover:gap-4 transition-all">
                                Join Existing Pro Org
                                <ArrowLeft className="w-5 h-5 rotate-180" />
                            </div>
                        </div>
                    </button>
                </div>

                {/* Info Note */}
                <div className="mt-8 text-center text-sm text-custom-cream/50">
                    Pro organizations are limited to 5 members maximum
                </div>
            </div>
        </div>
    );
}
