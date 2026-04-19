"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../config/firebase';
import { createOrganisation, isCustomDomain } from '../../../../services/userService';
import { ArrowLeft, Building, Loader2, CheckCircle, AlertCircle, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeProvider, useTheme } from '../../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../../utils/themeUtils';
import NoiseOverlay from '../../../../components/NoiseOverlay';
import { motion } from 'framer-motion';

function FormOrganisationPageContent() {
    const router = useRouter();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

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
                router.push('/onboarding/intro');
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
            <div className={`min-h-screen ${tc.bg} flex items-center justify-center`}>
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${tc.bg} ${tc.text} flex flex-col items-center justify-center p-6 py-12 relative overflow-hidden`}>
            {resolvedTheme === 'light' && <NoiseOverlay />}

            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-orange/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
            </div>

            {/* Theme Toggle */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={() => {
                        const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                        setTheme(nextTheme);
                    }}
                    className={`p-3 ${tc.sidebar} rounded-2xl hover:scale-110 transition-all duration-300 shadow-lg group relative`}
                >
                    {theme === 'light' ? (
                        <Moon className={`w-5 h-5 ${tc.text}`} />
                    ) : theme === 'dark' ? (
                        <svg className={`w-5 h-5 ${tc.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    ) : (
                        <Sun className={`w-5 h-5 ${tc.text}`} />
                    )}
                </button>
            </div>

            <div className="relative z-10 w-full max-w-3xl">
                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Link
                        href="/onboarding/organisation"
                        className={`inline-flex items-center gap-2 ${tc.textDim} hover:text-accent-orange transition-colors mb-8`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Organisation Options
                    </Link>
                </motion.div>

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className={`${tc.card} rounded-3xl p-8 md:p-12 shadow-2xl relative`}
                >
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
                        <div className="inline-block p-4 bg-gradient-to-br from-orange-600 to-accent-orange rounded-2xl mb-6">
                            <Building className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-accent-orange">
                            Form an Organisation
                        </h1>
                        <p className={tc.textDim}>
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
                            <div className={`${resolvedTheme === 'light' ? 'bg-accent-orange/10 border-2 border-accent-orange/30' : 'bg-accent-orange/10 border border-accent-orange/30'} rounded-xl p-6 mb-6 max-w-md mx-auto`}>
                                <p className={`text-sm ${tc.textDim} mb-2`}>Your Organisation ID:</p>
                                <div className={`${resolvedTheme === 'light' ? 'bg-text-main/5' : 'bg-custom-bg'} rounded-lg p-3 mb-3`}>
                                    <code className="text-accent-orange font-mono text-sm break-all">
                                        {organisationId}
                                    </code>
                                </div>
                                <p className={`text-xs ${tc.textDim}`}>
                                    Share this ID with team members to invite them to your organisation
                                </p>
                            </div>

                            <p className={tc.textDim}>
                                Redirecting you to your profile...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateOrganisation} className="space-y-6">
                            {/* Organisation Name */}
                            <div>
                                <label className={`block ${tc.text} font-semibold mb-3`}>
                                    Organisation Name *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Acme Corporation"
                                    className={`w-full ${tc.input} px-4 py-3.5 rounded-xl font-medium`}
                                    required
                                    disabled={creating}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className={`block ${tc.text} font-semibold mb-3`}>
                                    Description *
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Brief description of your organisation..."
                                    rows={4}
                                    className={`w-full ${tc.input} px-4 py-3.5 rounded-xl font-medium resize-none`}
                                    required
                                    disabled={creating}
                                />
                            </div>

                            {/* Sector/Industry */}
                            <div>
                                <label className={`block ${tc.text} font-semibold mb-3`}>
                                    Sector / Industry *
                                </label>
                                <select
                                    name="sector"
                                    value={formData.sector}
                                    onChange={handleInputChange}
                                    className={`w-full ${tc.input} px-4 py-3.5 rounded-xl font-medium`}
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
                                <label className={`block ${tc.text} font-semibold mb-3`}>
                                    Organisation Type *
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, incorporated: true }))}
                                        disabled={creating}
                                        className={`p-4 rounded-xl border-2 transition-all duration-300 ${formData.incorporated
                                            ? 'bg-accent-orange border-accent-orange text-white'
                                            : `${tc.card} border-accent-orange/30 hover:border-accent-orange`
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
                                            ? 'bg-accent-orange border-accent-orange text-white'
                                            : `${tc.card} border-accent-orange/30 hover:border-accent-orange`
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
                                className="w-full bg-accent-orange hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                        <div className={`mt-8 p-4 ${resolvedTheme === 'light' ? 'bg-accent-orange/10 border-2 border-accent-orange/30' : 'bg-accent-orange/10 border border-accent-orange/30'} rounded-xl`}>
                            <h4 className="text-sm font-bold text-accent-orange mb-2">
                                As an admin, you'll be able to:
                            </h4>
                            <ul className={`text-sm ${tc.textDim} space-y-1`}>
                                <li>• Invite and manage team members</li>
                                <li>• Access the organisation admin console</li>
                                <li>• Control organisation settings and permissions</li>
                                <li>• View analytics and usage reports</li>
                            </ul>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

export default function FormOrganisationPage() {
    return (
        <ThemeProvider>
            <FormOrganisationPageContent />
        </ThemeProvider>
    );
}
