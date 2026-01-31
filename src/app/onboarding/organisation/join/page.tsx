"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../config/firebase';
import { joinOrganisation, getOrganisation } from '../../../../services/userService';
import { ArrowLeft, Building2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function JoinOrganisationPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [organisationId, setOrganisationId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

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

    const handleJoinOrganisation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !organisationId.trim()) return;

        setJoining(true);
        setError('');

        try {
            // First, check if organisation exists
            const org = await getOrganisation(organisationId.trim());
            if (!org) {
                setError('Organisation not found. Please check the organisation ID and try again.');
                setJoining(false);
                return;
            }

            // Join the organisation
            const result = await joinOrganisation(user.uid, user.email, organisationId.trim());

            if (result) {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/profile');
                }, 2000);
            } else {
                setError('Failed to join organisation. Please try again.');
            }
        } catch (err: any) {
            console.error('Error joining organisation:', err);
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setJoining(false);
        }
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

            <div className="relative z-10 w-full max-w-2xl">
                {/* Back Button */}
                <Link
                    href="/onboarding/organisation"
                    className="inline-flex items-center gap-2 text-custom-cream/70 hover:text-custom-orange transition-colors mb-8"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to Organisation Options
                </Link>

                {/* Main Card */}
                <div className="bg-custom-cream/5 backdrop-blur-xl border border-custom-orange/20 rounded-3xl p-8 md:p-12 shadow-2xl shadow-custom-orange/10">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-block mb-6">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                width={60}
                                height={60}
                                className="w-15 h-15 hover:scale-110 transition-transform"
                            />
                        </Link>
                        <div className="inline-block p-4 bg-gradient-to-br from-custom-orange to-orange-600 rounded-2xl mb-6">
                            <Building2 className="w-10 h-10 text-custom-cream" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-custom-orange">
                            Join an Organisation
                        </h1>
                        <p className="text-custom-cream/70">
                            Enter the organisation ID provided by your admin
                        </p>
                    </div>

                    {success ? (
                        <div className="text-center py-8">
                            <div className="inline-block p-4 bg-green-500/20 rounded-full mb-4">
                                <CheckCircle className="w-12 h-12 text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-green-400 mb-2">
                                Successfully Joined!
                            </h3>
                            <p className="text-custom-cream/70">
                                Redirecting you to your profile...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleJoinOrganisation} className="space-y-6">
                            <div>
                                <label className="block text-custom-cream font-semibold mb-3">
                                    Organisation ID
                                </label>
                                <input
                                    type="text"
                                    value={organisationId}
                                    onChange={(e) => setOrganisationId(e.target.value)}
                                    placeholder="e.g., org_1234567890_abc123"
                                    className="w-full bg-custom-bg border border-custom-orange/30 rounded-xl px-4 py-3.5 text-custom-cream placeholder:text-custom-cream/30 focus:outline-none focus:border-custom-orange focus:ring-1 focus:ring-custom-orange/50 transition-all font-medium"
                                    required
                                    disabled={joining}
                                />
                                <p className="text-sm text-custom-cream/50 mt-2">
                                    Ask your organisation admin for the organisation ID
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={joining || !organisationId.trim()}
                                className="w-full bg-custom-orange hover:bg-orange-600 text-custom-cream font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-custom-orange/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {joining ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Joining Organisation...
                                    </>
                                ) : (
                                    'Join Organisation'
                                )}
                            </button>
                        </form>
                    )}

                    {/* Info Box */}
                    <div className="mt-8 p-4 bg-custom-orange/10 border border-custom-orange/30 rounded-xl">
                        <h4 className="text-sm font-bold text-custom-orange mb-2">
                            What happens next?
                        </h4>
                        <ul className="text-sm text-custom-cream/70 space-y-1">
                            <li>• You'll be added to the organisation's workspace</li>
                            <li>• Access shared projects and resources</li>
                            <li>• Collaborate with team members</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
