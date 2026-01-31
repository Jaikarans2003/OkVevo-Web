"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../config/firebase';
import { createOrganisation, isCustomDomain } from '../../../../services/userService';
import { ArrowLeft, Building, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function FormOrganisationPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [organisationId, setOrganisationId] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sector: '',
        incorporated: false,
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push('/login');
            } else if (!isCustomDomain(currentUser.email || '')) {
                // Redirect if user doesn't have custom domain
                router.push('/onboarding/organisation');
            } else {
                setUser(currentUser);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const handleCreateOrganisation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setCreating(true);
        setError('');

        try {
            const orgId = await createOrganisation({
                name: formData.name,
                description: formData.description,
                sector: formData.sector,
                incorporated: formData.incorporated,
                adminEmail: user.email,
                adminUid: user.uid,
            });

            setOrganisationId(orgId);
            setSuccess(true);

            // Redirect after showing success message
            setTimeout(() => {
                router.push('/profile');
            }, 5000);
        } catch (err: any) {
            console.error('Error creating organisation:', err);
            setError(err.message || 'Failed to create organisation. Please try again.');
        } finally {
            setCreating(false);
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
        <div className="min-h-screen bg-custom-bg text-custom-cream flex flex-col items-center justify-center p-6 py-12">
            {/* Background Animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-custom-orange/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 w-full max-w-3xl">
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
                        <div className="inline-block p-4 bg-gradient-to-br from-orange-600 to-custom-orange rounded-2xl mb-6">
                            <Building className="w-10 h-10 text-custom-cream" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-custom-orange">
                            Form an Organisation
                        </h1>
                        <p className="text-custom-cream/70">
                            Create your organisation and become the admin
                        </p>
                    </div>

                    {success ? (
                        <div className="text-center py-8">
                            <div className="inline-block p-4 bg-green-500/20 rounded-full mb-4">
                                <CheckCircle className="w-12 h-12 text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-green-400 mb-4">
                                Organisation Created Successfully!
                            </h3>

                            {/* Organisation ID Display */}
                            <div className="bg-custom-orange/10 border border-custom-orange/30 rounded-xl p-6 mb-6 max-w-md mx-auto">
                                <p className="text-sm text-custom-cream/70 mb-2">Your Organisation ID:</p>
                                <div className="bg-custom-bg rounded-lg p-3 mb-3">
                                    <code className="text-custom-orange font-mono text-sm break-all">
                                        {organisationId}
                                    </code>
                                </div>
                                <p className="text-xs text-custom-cream/50">
                                    Share this ID with team members to invite them to your organisation
                                </p>
                            </div>

                            <p className="text-custom-cream/70">
                                Redirecting you to your profile...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateOrganisation} className="space-y-6">
                            {/* Organisation Name */}
                            <div>
                                <label className="block text-custom-cream font-semibold mb-3">
                                    Organisation Name *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Acme Corporation"
                                    className="w-full bg-custom-bg border border-custom-orange/30 rounded-xl px-4 py-3.5 text-custom-cream placeholder:text-custom-cream/30 focus:outline-none focus:border-custom-orange focus:ring-1 focus:ring-custom-orange/50 transition-all font-medium"
                                    required
                                    disabled={creating}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-custom-cream font-semibold mb-3">
                                    Description *
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Brief description of your organisation..."
                                    rows={4}
                                    className="w-full bg-custom-bg border border-custom-orange/30 rounded-xl px-4 py-3.5 text-custom-cream placeholder:text-custom-cream/30 focus:outline-none focus:border-custom-orange focus:ring-1 focus:ring-custom-orange/50 transition-all font-medium resize-none"
                                    required
                                    disabled={creating}
                                />
                            </div>

                            {/* Sector/Industry */}
                            <div>
                                <label className="block text-custom-cream font-semibold mb-3">
                                    Sector / Industry *
                                </label>
                                <select
                                    name="sector"
                                    value={formData.sector}
                                    onChange={handleInputChange}
                                    className="w-full bg-custom-bg border border-custom-orange/30 rounded-xl px-4 py-3.5 text-custom-cream focus:outline-none focus:border-custom-orange focus:ring-1 focus:ring-custom-orange/50 transition-all font-medium"
                                    required
                                    disabled={creating}
                                >
                                    <option value="">Select a sector</option>
                                    <option value="Technology">Technology</option>
                                    <option value="Healthcare">Healthcare</option>
                                    <option value="Finance">Finance</option>
                                    <option value="Education">Education</option>
                                    <option value="Media & Entertainment">Media & Entertainment</option>
                                    <option value="Retail">Retail</option>
                                    <option value="Manufacturing">Manufacturing</option>
                                    <option value="Real Estate">Real Estate</option>
                                    <option value="Consulting">Consulting</option>
                                    <option value="Non-Profit">Non-Profit</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {/* Incorporated Status */}
                            <div>
                                <label className="block text-custom-cream font-semibold mb-3">
                                    Organisation Type *
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, incorporated: true }))}
                                        disabled={creating}
                                        className={`p-4 rounded-xl border-2 transition-all duration-300 ${formData.incorporated
                                            ? 'bg-custom-orange border-custom-orange text-custom-cream'
                                            : 'bg-custom-bg border-custom-orange/30 text-custom-cream/70 hover:border-custom-orange'
                                            }`}
                                    >
                                        <div className="font-bold mb-1">Incorporated</div>
                                        <div className="text-xs opacity-70">Registered company</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, incorporated: false }))}
                                        disabled={creating}
                                        className={`p-4 rounded-xl border-2 transition-all duration-300 ${!formData.incorporated
                                            ? 'bg-custom-orange border-custom-orange text-custom-cream'
                                            : 'bg-custom-bg border-custom-orange/30 text-custom-cream/70 hover:border-custom-orange'
                                            }`}
                                    >
                                        <div className="font-bold mb-1">Non-Incorporated</div>
                                        <div className="text-xs opacity-70">Unregistered entity</div>
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full bg-custom-orange hover:bg-orange-600 text-custom-cream font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-custom-orange/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating Organisation...
                                    </>
                                ) : (
                                    'Create Organisation'
                                )}
                            </button>
                        </form>
                    )}

                    {/* Info Box */}
                    {!success && (
                        <div className="mt-8 p-4 bg-custom-orange/10 border border-custom-orange/30 rounded-xl">
                            <h4 className="text-sm font-bold text-custom-orange mb-2">
                                As an admin, you'll be able to:
                            </h4>
                            <ul className="text-sm text-custom-cream/70 space-y-1">
                                <li>• Invite and manage team members</li>
                                <li>• Access the organisation admin dashboard</li>
                                <li>• Control organisation settings and permissions</li>
                                <li>• View analytics and usage reports</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
