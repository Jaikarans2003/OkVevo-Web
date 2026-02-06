"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import {
    getUserProfile,
    getOrganisation,
    getOrganisationMembers,
    updateMemberRole,
    removeMemberFromOrganisation
} from '../../../services/userService';
import type { UserProfile, Organisation } from '../../../services/userService';
import {
    Building2,
    Users,
    Shield,
    BarChart3,
    UserPlus,
    ArrowLeft,
    LogOut,
    Copy,
    CheckCircle,
    Loader2,
    Crown,
    UserMinus,
    AlertCircle,
    Sun,
    Moon
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeProvider, useTheme } from '../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../utils/themeUtils';
import NoiseOverlay from '../../../components/NoiseOverlay';
import { motion } from 'framer-motion';

function OrganisationDashboardContent() {
    const router = useRouter();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [user, setUser] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [organisation, setOrganisation] = useState<Organisation | null>(null);
    const [members, setMembers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [membersLoading, setMembersLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>('overview');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                router.push('/login');
                return;
            }

            setUser(currentUser);

            try {
                const profile = await getUserProfile(currentUser.uid);

                if (!profile) {
                    router.push('/onboarding');
                    return;
                }

                // Check if user is part of an organisation and is an admin
                if (profile.userType !== 'organisation' || profile.organisationRole !== 'admin') {
                    router.push('/profile');
                    return;
                }

                setUserProfile(profile);

                // Load organisation details
                if (profile.organisationId) {
                    const org = await getOrganisation(profile.organisationId);
                    setOrganisation(org);
                }
            } catch (error) {
                console.error('Error loading profile:', error);
                router.push('/profile');
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    // Load members when Members tab is active
    useEffect(() => {
        if (activeTab === 'members' && organisation?.id && members.length === 0) {
            loadMembers();
        }
    }, [activeTab, organisation]);

    const loadMembers = async () => {
        if (!organisation?.id) return;

        setMembersLoading(true);
        try {
            const membersList = await getOrganisationMembers(organisation.id);
            setMembers(membersList);
        } catch (error) {
            console.error('Error loading members:', error);
            setError('Failed to load members');
        } finally {
            setMembersLoading(false);
        }
    };

    const handlePromoteToAdmin = async (memberId: string) => {
        if (!organisation?.id || !userProfile?.uid) return;

        setActionLoading(memberId);
        setError('');

        try {
            await updateMemberRole(memberId, organisation.id, 'admin');
            await loadMembers();
        } catch (error) {
            console.error('Error promoting member:', error);
            setError('Failed to promote member to admin');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDemoteFromAdmin = async (memberId: string) => {
        if (!organisation?.id || !userProfile?.uid) return;

        setActionLoading(memberId);
        setError('');

        try {
            await updateMemberRole(memberId, organisation.id, 'member');
            await loadMembers();
        } catch (error) {
            console.error('Error demoting member:', error);
            setError('Failed to demote member');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveMember = async (memberId: string, memberEmail: string) => {
        if (!organisation?.id || !userProfile?.uid) return;

        if (memberId === userProfile.uid) {
            setError('You cannot remove yourself from the organisation');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to remove ${memberEmail} from the organisation? This action cannot be undone.`
        );

        if (!confirmed) return;

        setActionLoading(memberId);
        setError('');

        try {
            await removeMemberFromOrganisation(memberId, organisation.id);
            await loadMembers();
        } catch (error) {
            console.error('Error removing member:', error);
            setError('Failed to remove member from organisation');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCopyOrgId = () => {
        if (organisation?.id) {
            navigator.clipboard.writeText(organisation.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSignOut = async () => {
        try {
            await auth.signOut();
            router.push('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (loading) {
        return (
            <div className={`min-h-screen ${tc.bg} flex items-center justify-center`}>
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    if (!organisation || !userProfile) {
        return null;
    }

    const adminCount = members.filter(m => m.organisationRole === 'admin').length;

    return (
        <div className={`min-h-screen ${tc.bg} ${tc.text} relative overflow-hidden`}>
            {resolvedTheme === 'light' && <NoiseOverlay />}

            {/* Background Animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-orange/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
            </div>

            {/* Navbar */}
            <nav className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-auto">
                <div className={`${tc.sidebar} backdrop-blur-md rounded-full pl-6 pr-2 py-2 flex items-center gap-8 shadow-2xl`}>
                    <Link href="/chat" className="flex items-center gap-2 group">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={24}
                            height={24}
                            className="w-6 h-6 group-hover:scale-110 transition-transform"
                        />
                        <span className="font-[family-name:var(--font-museo-moderno)] font-bold text-lg tracking-wide">OKVEVO</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        {/* Theme Toggle */}
                        <button
                            onClick={() => {
                                const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                                setTheme(nextTheme);
                            }}
                            className={`p-2 ${tc.sidebar} rounded-xl hover:scale-110 transition-all duration-300`}
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

                        <Link
                            href="/profile"
                            className={`p-2 ${tc.textDim} hover:text-accent-orange transition-colors`}
                            title="Back to Profile"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className={`w-px h-6 bg-accent-orange/20`}></div>
                        <button
                            onClick={handleSignOut}
                            className={`px-6 py-2.5 ${resolvedTheme === 'light' ? 'bg-accent-orange/10' : 'bg-custom-cream/5'} hover:bg-red-500/10 ${tc.textDim} hover:text-red-400 text-sm font-bold rounded-full border ${resolvedTheme === 'light' ? 'border-accent-orange/20' : 'border-custom-orange/10'} hover:border-red-500/30 transition-all duration-300 flex items-center gap-2`}
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 pt-32 px-6 pb-12 max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl shadow-lg">
                            <Building2 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-accent-orange">{organisation.name}</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="px-3 py-1 bg-accent-orange/20 text-accent-orange text-xs font-bold rounded-full border border-accent-orange/50 flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    Admin
                                </span>
                                <span className={`${tc.textDim} text-sm`}>{organisation.sector}</span>
                                <span className={`${tc.textDim} text-sm`}>•</span>
                                <span className={`${tc.textDim} text-sm`}>
                                    {organisation.incorporated ? 'Incorporated' : 'Non-Incorporated'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className={`${tc.textDim} text-lg`}>{organisation.description}</p>
                </motion.div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Tabs */}
                <div className={`flex gap-2 mb-8 ${resolvedTheme === 'light' ? 'bg-accent-orange/10' : 'bg-custom-cream/5'} p-2 rounded-2xl border ${resolvedTheme === 'light' ? 'border-accent-orange/30' : 'border-custom-orange/20'} w-fit`}>
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'overview'
                            ? 'bg-accent-orange text-white shadow-lg'
                            : `${tc.textDim} hover:${tc.text} ${resolvedTheme === 'light' ? 'hover:bg-accent-orange/20' : 'hover:bg-custom-cream/5'}`
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'members'
                            ? 'bg-accent-orange text-white shadow-lg'
                            : `${tc.textDim} hover:${tc.text} ${resolvedTheme === 'light' ? 'hover:bg-accent-orange/20' : 'hover:bg-custom-cream/5'}`
                            }`}
                    >
                        Members
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'settings'
                            ? 'bg-accent-orange text-white shadow-lg'
                            : `${tc.textDim} hover:${tc.text} ${resolvedTheme === 'light' ? 'hover:bg-accent-orange/20' : 'hover:bg-custom-cream/5'}`
                            }`}
                    >
                        Settings
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Stats Grid */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                                className={`${tc.card} rounded-2xl p-6 hover:border-accent-orange transition-all`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <Users className="w-8 h-8 text-accent-orange" />
                                    <BarChart3 className={`w-5 h-5 ${tc.textDim}`} />
                                </div>
                                <div className={`text-3xl font-bold ${tc.text} mb-1`}>
                                    {organisation.members?.length || 0}
                                </div>
                                <div className={`text-sm ${tc.textDim}`}>Total Members</div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className={`${tc.card} rounded-2xl p-6 hover:border-accent-orange transition-all`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <Shield className="w-8 h-8 text-accent-orange" />
                                    <BarChart3 className={`w-5 h-5 ${tc.textDim}`} />
                                </div>
                                <div className={`text-3xl font-bold ${tc.text} mb-1`}>
                                    {members.length > 0 ? adminCount : '1'}
                                </div>
                                <div className={`text-sm ${tc.textDim}`}>Admin{adminCount !== 1 ? 's' : ''}</div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.3 }}
                                className={`${tc.card} rounded-2xl p-6 hover:border-accent-orange transition-all`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <Building2 className="w-8 h-8 text-accent-orange" />
                                    <BarChart3 className={`w-5 h-5 ${tc.textDim}`} />
                                </div>
                                <div className={`text-3xl font-bold ${tc.text} mb-1`}>Active</div>
                                <div className={`text-sm ${tc.textDim}`}>Status</div>
                            </motion.div>
                        </div>

                        {/* Organisation ID Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className={`bg-gradient-to-br ${resolvedTheme === 'light' ? 'from-accent-orange/10 to-orange-600/10 border-2 border-accent-orange/30' : 'from-custom-orange/10 to-orange-600/10 border border-custom-orange/30'} backdrop-blur-sm rounded-2xl p-6`}
                        >
                            <h3 className="text-lg font-bold text-accent-orange mb-4 flex items-center gap-2">
                                <UserPlus className="w-5 h-5" />
                                Invite Team Members
                            </h3>
                            <p className={`${tc.textDim} mb-4`}>
                                Share this organisation ID with your team members so they can join:
                            </p>
                            <div className="flex items-center gap-3">
                                <div className={`flex-1 ${resolvedTheme === 'light' ? 'bg-white' : 'bg-custom-bg'} rounded-xl p-4 border ${resolvedTheme === 'light' ? 'border-accent-orange/30' : 'border-custom-orange/30'}`}>
                                    <code className="text-accent-orange font-mono text-sm break-all">
                                        {organisation.id}
                                    </code>
                                </div>
                                <button
                                    onClick={handleCopyOrgId}
                                    className="px-6 py-4 bg-accent-orange hover:bg-orange-600 text-white rounded-xl font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
                                >
                                    {copied ? (
                                        <>
                                            <CheckCircle className="w-5 h-5" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-5 h-5" />
                                            Copy ID
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className={`${tc.card} rounded-2xl p-8`}>
                        <h3 className="text-2xl font-bold text-accent-orange mb-6">Team Members</h3>

                        {membersLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-accent-orange animate-spin" />
                            </div>
                        ) : members.length > 0 ? (
                            <div className="space-y-4">
                                {members.map((member) => (
                                    <div
                                        key={member.uid}
                                        className={`flex items-center justify-between p-4 ${resolvedTheme === 'light' ? 'bg-accent-orange/5 border-2 border-accent-orange/20' : 'bg-custom-bg/50 border border-custom-orange/10'} rounded-xl hover:border-accent-orange transition-all`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-accent-orange to-orange-600 rounded-full flex items-center justify-center">
                                                <span className="text-lg font-bold text-white">
                                                    {member.email[0].toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className={`font-bold ${tc.text}`}>{member.email}</div>
                                                <div className={`text-sm ${tc.textDim}`}>
                                                    {member.uid === userProfile?.uid && 'You • '}
                                                    <span className="capitalize">{member.organisationRole}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {member.organisationRole === 'admin' ? (
                                                <span className="px-3 py-1 bg-accent-orange/20 text-accent-orange text-xs font-bold rounded-full border border-accent-orange/50 flex items-center gap-1">
                                                    <Shield className="w-3 h-3" />
                                                    Admin
                                                </span>
                                            ) : (
                                                <span className={`px-3 py-1 ${resolvedTheme === 'light' ? 'bg-gray-200 text-gray-600 border-gray-300' : 'bg-custom-cream/10 text-custom-cream/60 border-custom-cream/20'} text-xs font-bold rounded-full border`}>
                                                    Member
                                                </span>
                                            )}

                                            {member.uid !== userProfile?.uid && (
                                                <div className="flex items-center gap-2">
                                                    {member.organisationRole === 'member' ? (
                                                        <button
                                                            onClick={() => handlePromoteToAdmin(member.uid)}
                                                            disabled={actionLoading === member.uid}
                                                            className="px-4 py-2 bg-accent-orange/10 hover:bg-accent-orange/20 text-accent-orange border border-accent-orange/30 hover:border-accent-orange rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Promote to Admin"
                                                        >
                                                            {actionLoading === member.uid ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Crown className="w-3 h-3" />
                                                                    Make Admin
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDemoteFromAdmin(member.uid)}
                                                            disabled={actionLoading === member.uid}
                                                            className={`px-4 py-2 ${resolvedTheme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-300' : 'bg-custom-cream/5 hover:bg-custom-cream/10 text-custom-cream/70 border-custom-cream/20'} border hover:border-custom-cream/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                                                            title="Demote from Admin"
                                                        >
                                                            {actionLoading === member.uid ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                'Remove Admin'
                                                            )}
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => handleRemoveMember(member.uid, member.email)}
                                                        disabled={actionLoading === member.uid}
                                                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Remove from Organisation"
                                                    >
                                                        {actionLoading === member.uid ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <UserMinus className="w-3 h-3" />
                                                                Remove
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={`text-center ${tc.textDim} py-8`}>
                                No members found. Share your organisation ID to invite team members!
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className={`${tc.card} rounded-2xl p-8`}>
                        <h3 className="text-2xl font-bold text-accent-orange mb-6">Organisation Settings</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-accent-orange mb-2">Organisation Name</label>
                                <input
                                    type="text"
                                    value={organisation.name}
                                    disabled
                                    className={`w-full ${resolvedTheme === 'light' ? 'bg-gray-100' : 'bg-custom-bg/50'} border ${resolvedTheme === 'light' ? 'border-accent-orange/30' : 'border-custom-orange/30'} rounded-xl px-4 py-3 ${tc.text} opacity-60 cursor-not-allowed`}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-accent-orange mb-2">Description</label>
                                <textarea
                                    value={organisation.description}
                                    disabled
                                    rows={3}
                                    className={`w-full ${resolvedTheme === 'light' ? 'bg-gray-100' : 'bg-custom-bg/50'} border ${resolvedTheme === 'light' ? 'border-accent-orange/30' : 'border-custom-orange/30'} rounded-xl px-4 py-3 ${tc.text} opacity-60 cursor-not-allowed resize-none`}
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-accent-orange mb-2">Sector</label>
                                    <input
                                        type="text"
                                        value={organisation.sector}
                                        disabled
                                        className={`w-full ${resolvedTheme === 'light' ? 'bg-gray-100' : 'bg-custom-bg/50'} border ${resolvedTheme === 'light' ? 'border-accent-orange/30' : 'border-custom-orange/30'} rounded-xl px-4 py-3 ${tc.text} opacity-60 cursor-not-allowed`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-accent-orange mb-2">Type</label>
                                    <input
                                        type="text"
                                        value={organisation.incorporated ? 'Incorporated' : 'Non-Incorporated'}
                                        disabled
                                        className={`w-full ${resolvedTheme === 'light' ? 'bg-gray-100' : 'bg-custom-bg/50'} border ${resolvedTheme === 'light' ? 'border-accent-orange/30' : 'border-custom-orange/30'} rounded-xl px-4 py-3 ${tc.text} opacity-60 cursor-not-allowed`}
                                    />
                                </div>
                            </div>

                            <div className={`pt-4 border-t ${resolvedTheme === 'light' ? 'border-accent-orange/20' : 'border-custom-orange/20'}`}>
                                <p className={`text-sm ${tc.textDim}`}>
                                    Settings editing will be available in a future update.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function OrganisationDashboard() {
    return (
        <ThemeProvider>
            <OrganisationDashboardContent />
        </ThemeProvider>
    );
}
