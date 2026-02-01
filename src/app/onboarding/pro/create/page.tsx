"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../config/firebase';
import { createProOrganisation } from '../../../../services/userService';
import { Building2, ArrowLeft, Loader2, CheckCircle, Copy } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function CreateProOrganisationPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [orgId, setOrgId] = useState('');
    const [copied, setCopied] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setCreating(true);
        setError('');

        try {
            const proOrgId = await createProOrganisation({
                name,
                description,
                adminEmail: user.email || '',
                adminUid: user.uid,
            });

            setOrgId(proOrgId);
        } catch (err: any) {
            console.error('Error creating Pro organisation:', err);
            setError('Failed to create Pro organisation. Please try again.');
        } finally {
            setCreating(false);
        }
    };

    const handleCopyOrgId = () => {
        navigator.clipboard.writeText(orgId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

    // Success state - show organization ID
    if (orgId) {
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
                            Pro Organisation Created!
                        </h1>
                        <p className="text-custom-cream/70 mb-8">
                            Your Pro organization <span className="text-custom-orange font-bold">{name}</span> has been successfully created.
                        </p>

                        {/* Organisation ID */}
                        <div className="bg-custom-cream/5 border border-custom-orange/20 rounded-xl p-6 mb-8">
                            <p className="text-sm text-custom-cream/60 mb-2">Organisation ID</p>
                            <div className="flex items-center gap-3 justify-center">
                                <code className="text-custom-orange font-mono text-lg bg-custom-bg/50 px-4 py-2 rounded-lg">
                                    {orgId}
                                </code>
                                <button
                                    onClick={handleCopyOrgId}
                                    className="p-2 bg-custom-orange/20 hover:bg-custom-orange/30 rounded-lg transition-colors"
                                >
                                    {copied ? (
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <Copy className="w-5 h-5 text-custom-orange" />
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-custom-cream/50 mt-3">
                                Share this ID with team members to invite them (max 4 more members)
                            </p>
                        </div>

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
                        Create Pro Organisation
                    </h1>
                    <p className="text-custom-cream/70">
                        Set up your Pro organization and invite your team
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-custom-cream/5 backdrop-blur-sm border-2 border-custom-orange/30 rounded-3xl p-8">
                    <div className="space-y-6">
                        {/* Organisation Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="p-6 bg-gradient-to-br from-custom-orange to-orange-600 rounded-2xl shadow-lg">
                                <Building2 className="w-10 h-10 text-custom-cream" />
                            </div>
                        </div>

                        {/* Organisation Name */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-custom-cream/80 mb-2">
                                Organisation Name *
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Creative Team Pro"
                                className="w-full bg-custom-cream/5 border border-custom-orange/20 rounded-xl px-4 py-3.5 text-custom-cream placeholder:text-custom-cream/30 focus:outline-none focus:border-custom-orange focus:ring-1 focus:ring-custom-orange/50 transition-all"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-custom-cream/80 mb-2">
                                Description *
                            </label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of your Pro organization"
                                rows={4}
                                className="w-full bg-custom-cream/5 border border-custom-orange/20 rounded-xl px-4 py-3.5 text-custom-cream placeholder:text-custom-cream/30 focus:outline-none focus:border-custom-orange focus:ring-1 focus:ring-custom-orange/50 transition-all resize-none"
                                required
                            />
                        </div>

                        {/* Info Box */}
                        <div className="bg-custom-orange/10 border border-custom-orange/30 rounded-xl p-4">
                            <p className="text-sm text-custom-cream/80">
                                <strong className="text-custom-orange">Note:</strong> You can invite up to 4 additional members to your Pro organization (5 total including you).
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={creating}
                            className="w-full bg-gradient-to-r from-custom-orange to-orange-600 hover:from-orange-600 hover:to-custom-orange text-custom-cream font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-custom-orange/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Building2 className="w-5 h-5" />
                                    Create Pro Organisation
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
