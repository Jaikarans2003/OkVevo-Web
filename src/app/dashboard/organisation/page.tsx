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
    Settings,
    BarChart3,
    UserPlus,
    Shield,
    ArrowLeft,
    LogOut,
    Copy,
    CheckCircle,
    Loader2,
    Crown,
    UserMinus,
    AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function OrganisationDashboard() {
    const router = useRouter();
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
            // Reload members to reflect changes
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
            // Reload members to reflect changes
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

        // Prevent admin from removing themselves
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
            // Reload members to reflect changes
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
            <div className="min-h-screen bg-custom-bg flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-custom-orange animate-spin" />
            </div>
        );
    }

    if (!organisation || !userProfile) {
        return null;
    }

    const adminCount = members.filter(m => m.organisationRole === 'admin').length;

    return (
        <div className="min-h-screen bg-custom-bg text-custom-cream">
            {/* Background Animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-custom-orange/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            {/* Navbar */}
            <nav className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-auto">
                <div className="bg-custom-bg/80 backdrop-blur-md border border-custom-orange/20 rounded-full pl-6 pr-2 py-2 flex items-center gap-8 shadow-2xl shadow-custom-orange/10">
                    <Link href="/chat" className="flex items-center gap-2 group">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={24}
                            height={24}
                            className="w-6 h-6 group-hover:scale-110 transition-transform"
                        />
                        <span className="font-[family-name:var(--font-museo-moderno)] font-bold text-lg text-custom-cream tracking-wide">OKVEVO</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <Link
                            href="/profile"
                            className="p-2 text-custom-cream/70 hover:text-custom-orange transition-colors"
                            title="Back to Profile"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="w-px h-6 bg-custom-orange/20"></div>
                        <button
                            onClick={handleSignOut}
                            className="px-6 py-2.5 bg-custom-cream/5 hover:bg-red-500/10 text-custom-cream/70 hover:text-red-400 text-sm font-bold rounded-full border border-custom-orange/10 hover:border-red-500/30 transition-all duration-300 flex items-center gap-2"
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
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-gradient-to-br from-custom-orange to-orange-600 rounded-2xl shadow-lg">
                            <Building2 className="w-8 h-8 text-custom-cream" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-custom-orange">{organisation.name}</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="px-3 py-1 bg-custom-orange/20 text-custom-orange text-xs font-bold rounded-full border border-custom-orange/50 flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    Admin
                                </span>
                                <span className="text-custom-cream/60 text-sm">{organisation.sector}</span>
                                <span className="text-custom-cream/60 text-sm">•</span>
                                <span className="text-custom-cream/60 text-sm">
                                    {organisation.incorporated ? 'Incorporated' : 'Non-Incorporated'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className="text-custom-cream/70 text-lg">{organisation.description}</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2 mb-8 bg-custom-cream/5 p-2 rounded-2xl border border-custom-orange/20 w-fit">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'overview'
                                ? 'bg-custom-orange text-custom-cream shadow-lg'
                                : 'text-custom-cream/70 hover:text-custom-cream hover:bg-custom-cream/5'
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'members'
                                ? 'bg-custom-orange text-custom-cream shadow-lg'
                                : 'text-custom-cream/70 hover:text-custom-cream hover:bg-custom-cream/5'
                            }`}
                    >
                        Members
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'settings'
                                ? 'bg-custom-orange text-custom-cream shadow-lg'
                                : 'text-custom-cream/70 hover:text-custom-cream hover:bg-custom-cream/5'
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
                            <div className="bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/30 rounded-2xl p-6 hover:border-custom-orange transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <Users className="w-8 h-8 text-custom-orange" />
                                    <BarChart3 className="w-5 h-5 text-custom-cream/40" />
                                </div>
                                <div className="text-3xl font-bold text-custom-cream mb-1">
                                    {organisation.members?.length || 0}
                                </div>
                                <div className="text-sm text-custom-cream/60">Total Members</div>
                            </div>

                            <div className="bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/30 rounded-2xl p-6 hover:border-custom-orange transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <Shield className="w-8 h-8 text-custom-orange" />
                                    <BarChart3 className="w-5 h-5 text-custom-cream/40" />
                                </div>
                                <div className="text-3xl font-bold text-custom-cream mb-1">
                                    {members.length > 0 ? adminCount : '1'}
                                </div>
                                <div className="text-sm text-custom-cream/60">Admin{adminCount !== 1 ? 's' : ''}</div>
                            </div>

                            <div className="bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/30 rounded-2xl p-6 hover:border-custom-orange transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <Building2 className="w-8 h-8 text-custom-orange" />
                                    <BarChart3 className="w-5 h-5 text-custom-cream/40" />
                                </div>
                                <div className="text-3xl font-bold text-custom-cream mb-1">Active</div>
                                <div className="text-sm text-custom-cream/60">Status</div>
                            </div>
                        </div>

                        {/* Organisation ID Card */}
                        <div className="bg-gradient-to-br from-custom-orange/10 to-orange-600/10 backdrop-blur-sm border border-custom-orange/30 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-custom-orange mb-4 flex items-center gap-2">
                                <UserPlus className="w-5 h-5" />
                                Invite Team Members
                            </h3>
                            <p className="text-custom-cream/70 mb-4">
                                Share this organisation ID with your team members so they can join:
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-custom-bg rounded-xl p-4 border border-custom-orange/30">
                                    <code className="text-custom-orange font-mono text-sm break-all">
                                        {organisation.id}
                                    </code>
                                </div>
                                <button
                                    onClick={handleCopyOrgId}
                                    className="px-6 py-4 bg-custom-orange hover:bg-orange-600 text-custom-cream rounded-xl font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
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
                        </div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/20 rounded-2xl p-8">
                        <h3 className="text-2xl font-bold text-custom-orange mb-6">Team Members</h3>

                        {membersLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-custom-orange animate-spin" />
                            </div>
                        ) : members.length > 0 ? (
                            <div className="space-y-4">
                                {members.map((member) => (
                                    <div
                                        key={member.uid}
                                        className="flex items-center justify-between p-4 bg-custom-bg/50 border border-custom-orange/10 rounded-xl hover:border-custom-orange/30 transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-custom-orange to-orange-600 rounded-full flex items-center justify-center">
                                                <span className="text-lg font-bold text-custom-cream">
                                                    {member.email[0].toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-bold text-custom-cream">{member.email}</div>
                                                <div className="text-sm text-custom-cream/60">
                                                    {member.uid === userProfile?.uid && 'You • '}
                                                    <span className="capitalize">{member.organisationRole}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {member.organisationRole === 'admin' ? (
                                                <span className="px-3 py-1 bg-custom-orange/20 text-custom-orange text-xs font-bold rounded-full border border-custom-orange/50 flex items-center gap-1">
                                                    <Shield className="w-3 h-3" />
                                                    Admin
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-custom-cream/10 text-custom-cream/60 text-xs font-bold rounded-full border border-custom-cream/20">
                                                    Member
                                                </span>
                                            )}

                                            {/* Only show controls for other members */}
                                            {member.uid !== userProfile?.uid && (
                                                <div className="flex items-center gap-2">
                                                    {member.organisationRole === 'member' ? (
                                                        <button
                                                            onClick={() => handlePromoteToAdmin(member.uid)}
                                                            disabled={actionLoading === member.uid}
                                                            className="px-4 py-2 bg-custom-orange/10 hover:bg-custom-orange/20 text-custom-orange border border-custom-orange/30 hover:border-custom-orange rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                                            className="px-4 py-2 bg-custom-cream/5 hover:bg-custom-cream/10 text-custom-cream/70 border border-custom-cream/20 hover:border-custom-cream/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <div className="text-center text-custom-cream/60 py-8">
                                No members found. Share your organisation ID to invite team members!
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/20 rounded-2xl p-8">
                        <h3 className="text-2xl font-bold text-custom-orange mb-6">Organisation Settings</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-custom-orange mb-2">Organisation Name</label>
                                <input
                                    type="text"
                                    value={organisation.name}
                                    disabled
                                    className="w-full bg-custom-bg/50 border border-custom-orange/30 rounded-xl px-4 py-3 text-custom-cream opacity-60 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-custom-orange mb-2">Description</label>
                                <textarea
                                    value={organisation.description}
                                    disabled
                                    rows={3}
                                    className="w-full bg-custom-bg/50 border border-custom-orange/30 rounded-xl px-4 py-3 text-custom-cream opacity-60 cursor-not-allowed resize-none"
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-custom-orange mb-2">Sector</label>
                                    <input
                                        type="text"
                                        value={organisation.sector}
                                        disabled
                                        className="w-full bg-custom-bg/50 border border-custom-orange/30 rounded-xl px-4 py-3 text-custom-cream opacity-60 cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-custom-orange mb-2">Type</label>
                                    <input
                                        type="text"
                                        value={organisation.incorporated ? 'Incorporated' : 'Non-Incorporated'}
                                        disabled
                                        className="w-full bg-custom-bg/50 border border-custom-orange/30 rounded-xl px-4 py-3 text-custom-cream opacity-60 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-custom-orange/20">
                                <p className="text-sm text-custom-cream/50">
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
