"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../config/firebase';
import { joinProOrganisation, checkProMemberLimit, getProOrganisation } from '../../../../services/userService';
import { Users, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function JoinProOrganisationPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [orgName, setOrgName] = useState('');

    // Form state
    const [organisationId, setOrganisationId] = useState('');
    const [validating, setValidating] = useState(false);
    const [orgInfo, setOrgInfo] = useState<{ name: string; currentCount: number; maxCount: number } | null>(null);

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

    const handleValidateOrgId = async () => {
        if (!organisationId.trim()) return;

        setValidating(true);
        setError('');
        setOrgInfo(null);

        try {
            const org = await getProOrganisation(organisationId.trim());
            if (!org) {
                setError('Organisation not found. Please check the ID and try again.');
                setValidating(false);
                return;
            }

            const limitCheck = await checkProMemberLimit(organisationId.trim());
            if (!limitCheck.canJoin) {
                setError('This Pro organisation has reached its maximum capacity (5 members).');
                setValidating(false);
                return;
            }

            setOrgInfo({
                name: org.name,
                currentCount: limitCheck.currentCount,
                maxCount: limitCheck.maxCount,
            });
        } catch (err: any) {
            console.error('Error validating organisation:', err);
            setError('Failed to validate organisation. Please try again.');
        } finally {
            setValidating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !orgInfo) return;

        setJoining(true);
        setError('');

        try {
            const joined = await joinProOrganisation(user.uid, user.email || '', organisationId.trim());

            if (joined) {
                setOrgName(orgInfo.name);
                setSuccess(true);
            } else {
                setError('Failed to join organisation. Please check the ID and try again.');
            }
        } catch (err: any) {
            console.error('Error joining Pro organisation:', err);
            if (err.message.includes('maximum capacity')) {
                setError('This Pro organisation has reached its maximum capacity (5 members).');
            } else {
                setError('Failed to join Pro organisation. Please try again.');
            }
        } finally {
            setJoining(false);
        }
    };

    const handleContinue = () => {
        router.push('/profile');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-custom-bg flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-custom-orange animate-spin" />
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen bg-custom-bg text-custom-cream flex flex-col items-center justify-center p-6">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-custom-orange/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
                </div>

                <div className="relative z-10 w-full max-w-2xl">
                    <div className="bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-10 text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-6">
                            <CheckCircle className="w-10 h-10 text-custom-cream" />
                        </div>

                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-custom-orange">
                            Successfully Joined!
                        </h1>
                        <p className="text-custom-cream/70 mb-8">
                            You are now a member of <span className="text-custom-orange font-bold">{orgName}</span> Pro organisation.
                        </p>

                        <button
                            onClick={handleContinue}
                            className="w-full bg-gradient-to-r from-custom-orange to-orange-600 hover:from-orange-600 hover:to-custom-orange text-custom-cream font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-custom-orange/30"
                        >
                            Continue to Profile
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Form state
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
                    href="/onboarding/pro"
                    className="inline-flex items-center gap-2 text-custom-cream/60 hover:text-custom-cream transition-colors mb-8"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                </Link>

                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block mb-4">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={60}
                            height={60}
                            className="w-16 h-16 hover:scale-110 transition-transform"
                        />
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-bold mb-3 text-custom-orange">
                        Join Pro Organisation
                    </h1>
                    <p className="text-custom-cream/70">
                        Enter the organisation ID provided by your admin
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-8">
                    <div className="space-y-6">
                        {/* Organisation Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="p-6 bg-gradient-to-br from-custom-orange to-orange-600 rounded-2xl shadow-lg">
                                <Users className="w-10 h-10 text-custom-cream" />
                            </div>
                        </div>

                        {/* Organisation ID */}
                        <div>
                            <label htmlFor="organisationId" className="block text-sm font-medium text-custom-cream/80 mb-2">
                                Organisation ID *
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    id="organisationId"
                                    value={organisationId}
                                    onChange={(e) => {
                                        setOrganisationId(e.target.value);
                                        setOrgInfo(null);
                                        setError('');
                                    }}
                                    placeholder="pro_1234567890_abcdefghi"
                                    className="flex-1 bg-custom-cream/5 border border-custom-orange/20 rounded-xl px-4 py-3.5 text-custom-cream placeholder:text-custom-cream/30 focus:outline-none focus:border-custom-orange focus:ring-1 focus:ring-custom-orange/50 transition-all font-mono text-sm"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={handleValidateOrgId}
                                    disabled={validating || !organisationId.trim()}
                                    className="px-6 bg-custom-orange/20 hover:bg-custom-orange/30 border border-custom-orange/40 text-custom-orange font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {validating ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'Validate'
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-custom-cream/50 mt-2">
                                Ask your admin for the organisation ID
                            </p>
                        </div>

                        {/* Organisation Info */}
                        {orgInfo && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-green-400 font-medium mb-1">Organisation Found!</p>
                                        <p className="text-custom-cream/80 text-sm">
                                            <strong>{orgInfo.name}</strong>
                                        </p>
                                        <p className="text-custom-cream/60 text-xs mt-1">
                                            Members: {orgInfo.currentCount}/{orgInfo.maxCount}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={joining || !orgInfo}
                            className="w-full bg-gradient-to-r from-custom-orange to-orange-600 hover:from-orange-600 hover:to-custom-orange text-custom-cream font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-custom-orange/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {joining ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                <>
                                    <Users className="w-5 h-5" />
                                    Join Pro Organisation
                                </>
                            )}
                        </button>

                        {!orgInfo && (
                            <p className="text-xs text-custom-cream/50 text-center">
                                Please validate the organisation ID before joining
                            </p>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
