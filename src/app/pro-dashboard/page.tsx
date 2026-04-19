"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import {
    getUserProfile,
    getProOrganisation,
    getProOrganisationMembers,
    updateProMemberRole,
    removeProMemberFromOrganisation,
    joinProOrganisation,
    getUserByEmail,
} from '../../services/userService';
import type { UserProfile, ProOrganisation } from '../../services/userService';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Loader2,
    Crown,
    Users,
    Copy,
    CheckCircle,
    Shield,
    ShieldOff,
    UserMinus,
    AlertTriangle,
    X,
    Check,
    UserPlus,
    Mail,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

type ConfirmAction =
    | { type: 'remove'; member: UserProfile }
    | { type: 'makeAdmin'; member: UserProfile }
    | { type: 'removeAdmin'; member: UserProfile }
    | null;

export default function ProDashboardPage() {
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [proOrg, setProOrg] = useState<ProOrganisation | null>(null);
    const [members, setMembers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [showAddMember, setShowAddMember] = useState(false);
    const [addEmail, setAddEmail] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    const isAdmin = profile?.proOrganisationRole === 'admin';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }
            setCurrentUser(user);
            try {
                const p = await getUserProfile(user.uid);
                setProfile(p);
                if (p?.proOrganisationId) {
                    const org = await getProOrganisation(p.proOrganisationId);
                    setProOrg(org);
                    const m = await getProOrganisationMembers(p.proOrganisationId);
                    setMembers(m);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proOrg?.id || !addEmail.trim()) return;
        setAddLoading(true);
        try {
            const targetUser = await getUserByEmail(addEmail.trim().toLowerCase());
            if (!targetUser) {
                showToast('error', 'No account found with that email address.');
                return;
            }
            if (targetUser.proOrganisationId) {
                showToast('error', 'This user is already in a Pro Team.');
                return;
            }
            await joinProOrganisation(targetUser.uid, targetUser.email, proOrg.id);
            const updated = await getProOrganisationMembers(proOrg.id);
            setMembers(updated);
            setAddEmail('');
            setShowAddMember(false);
            showToast('success', `${targetUser.email} has been added to the team.`);
        } catch (err: any) {
            showToast('error', err.message || 'Failed to add member.');
        } finally {
            setAddLoading(false);
        }
    };

    const handleCopyId = () => {
        if (!proOrg?.id) return;
        navigator.clipboard.writeText(proOrg.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleConfirm = async () => {
        if (!confirmAction || !proOrg?.id) return;
        setActionLoading(true);
        try {
            if (confirmAction.type === 'remove') {
                await removeProMemberFromOrganisation(confirmAction.member.uid, proOrg.id);
                setMembers(prev => prev.filter(m => m.uid !== confirmAction.member.uid));
                showToast('success', `${confirmAction.member.email} removed from the team.`);
            } else if (confirmAction.type === 'makeAdmin') {
                await updateProMemberRole(confirmAction.member.uid, proOrg.id, 'admin');
                setMembers(prev =>
                    prev.map(m =>
                        m.uid === confirmAction.member.uid
                            ? { ...m, proOrganisationRole: 'admin' }
                            : m
                    )
                );
                showToast('success', `${confirmAction.member.email} is now an admin.`);
            } else if (confirmAction.type === 'removeAdmin') {
                await updateProMemberRole(confirmAction.member.uid, proOrg.id, 'member');
                setMembers(prev =>
                    prev.map(m =>
                        m.uid === confirmAction.member.uid
                            ? { ...m, proOrganisationRole: 'member' }
                            : m
                    )
                );
                showToast('success', `${confirmAction.member.email} is now a member.`);
            }
        } catch (err: any) {
            showToast('error', err.message || 'Action failed. Please try again.');
        } finally {
            setActionLoading(false);
            setConfirmAction(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent-orange animate-spin" />
            </div>
        );
    }

    if (!profile?.proOrganisationId || !proOrg) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 p-6">
                <Crown className="w-16 h-16 text-amber-400 opacity-40" />
                <p className="text-white/40 text-lg font-bold">You're not part of a Pro Team yet.</p>
                <Link
                    href="/onboarding/pro/create"
                    className="px-8 py-4 bg-accent-orange hover:bg-orange-600 text-white font-black rounded-2xl transition-colors"
                >
                    Create Pro Team
                </Link>
            </div>
        );
    }

    const seatsFilled = members.length;
    const seatsTotal = proOrg.maxMembers || 5;

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[700px] h-[700px] bg-accent-orange/5 rounded-full blur-[180px]" />
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold shadow-2xl border ${
                            toast.type === 'success'
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}
                    >
                        {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirm Modal */}
            <AnimatePresence>
                {confirmAction && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 max-w-sm w-full"
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
                                confirmAction.type === 'remove' ? 'bg-red-500/10' : 'bg-amber-500/10'
                            }`}>
                                {confirmAction.type === 'remove' ? (
                                    <UserMinus className="w-6 h-6 text-red-400" />
                                ) : confirmAction.type === 'makeAdmin' ? (
                                    <Shield className="w-6 h-6 text-amber-400" />
                                ) : (
                                    <ShieldOff className="w-6 h-6 text-amber-400" />
                                )}
                            </div>
                            <h3 className="text-lg font-black text-center mb-2">
                                {confirmAction.type === 'remove' && 'Remove Member'}
                                {confirmAction.type === 'makeAdmin' && 'Make Admin'}
                                {confirmAction.type === 'removeAdmin' && 'Remove Admin'}
                            </h3>
                            <p className="text-white/40 text-sm text-center mb-8 leading-relaxed">
                                {confirmAction.type === 'remove' &&
                                    `Remove ${confirmAction.member.email} from the team? They will lose access immediately.`}
                                {confirmAction.type === 'makeAdmin' &&
                                    `Grant admin privileges to ${confirmAction.member.email}?`}
                                {confirmAction.type === 'removeAdmin' &&
                                    `Remove admin privileges from ${confirmAction.member.email}?`}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={actionLoading}
                                    className={`flex-1 py-3.5 font-black rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                                        confirmAction.type === 'remove'
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-amber-500 hover:bg-amber-600 text-black'
                                    }`}
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <Link
                        href="/profile"
                        className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Profile</span>
                    </Link>
                    <Link href="/">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO"
                            width={40}
                            height={40}
                            className="w-10 h-10"
                        />
                    </Link>
                </div>

                {/* Org Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center">
                            <Crown className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Pro Team</p>
                            <h1 className="text-2xl font-black">{proOrg.name}</h1>
                        </div>
                    </div>
                    {proOrg.description && (
                        <p className="text-white/40 text-sm mt-3 ml-16">{proOrg.description}</p>
                    )}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Members', value: `${seatsFilled} / ${seatsTotal}` },
                        { label: 'Your Role', value: isAdmin ? 'Admin' : 'Member' },
                        { label: 'Sector', value: proOrg.sector || '—' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 mb-1">{s.label}</p>
                            <p className="text-lg font-black text-white">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Invite ID */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 mb-1">Team ID — Share to Invite</p>
                        <code className="text-accent-orange font-mono text-sm break-all">{proOrg.id}</code>
                    </div>
                    <button
                        onClick={handleCopyId}
                        className="flex-shrink-0 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-white/40" />}
                    </button>
                </div>

                {/* Seat bar */}
                <div className="mb-3 flex items-center justify-between text-xs font-bold text-white/30 uppercase tracking-widest">
                    <span>Team Members</span>
                    <span>{seatsFilled}/{seatsTotal} seats</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full mb-8">
                    <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${(seatsFilled / seatsTotal) * 100}%` }}
                    />
                </div>

                {/* Members List */}
                <div className="space-y-3">
                    {members.map((member, i) => {
                        const memberIsAdmin = member.proOrganisationRole === 'admin';
                        const isSelf = member.uid === currentUser?.uid;

                        return (
                            <motion.div
                                key={member.uid}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center justify-between bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl px-6 py-5 transition-all"
                            >
                                {/* Avatar + Info */}
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
                                        memberIsAdmin
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : 'bg-white/5 text-white/50 border border-white/10'
                                    }`}>
                                        {member.email?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">
                                            {member.email}
                                            {isSelf && (
                                                <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-accent-orange bg-accent-orange/10 px-2 py-0.5 rounded-full">
                                                    You
                                                </span>
                                            )}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {memberIsAdmin
                                                ? <Shield className="w-3 h-3 text-amber-400" />
                                                : <Users className="w-3 h-3 text-white/20" />
                                            }
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                memberIsAdmin ? 'text-amber-400' : 'text-white/30'
                                            }`}>
                                                {memberIsAdmin ? 'Admin' : 'Member'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions — only admin can act, can't act on self */}
                                {isAdmin && !isSelf && (
                                    <div className="flex items-center gap-2">
                                        {memberIsAdmin ? (
                                            <button
                                                onClick={() => setConfirmAction({ type: 'removeAdmin', member })}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-xl transition-colors"
                                                title="Remove admin"
                                            >
                                                <ShieldOff className="w-3.5 h-3.5" />
                                                Remove Admin
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmAction({ type: 'makeAdmin', member })}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-xl transition-colors"
                                                title="Make admin"
                                            >
                                                <Shield className="w-3.5 h-3.5" />
                                                Make Admin
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setConfirmAction({ type: 'remove', member })}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-colors"
                                            title="Remove member"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Add Member (admin only, seats available) */}
                {isAdmin && seatsFilled < seatsTotal && (
                    <div className="mt-4">
                        {!showAddMember ? (
                            <button
                                onClick={() => setShowAddMember(true)}
                                className="w-full flex items-center justify-center gap-2 py-4 border border-dashed border-white/10 hover:border-accent-orange/40 hover:bg-accent-orange/5 rounded-2xl text-white/30 hover:text-accent-orange text-sm font-bold transition-all"
                            >
                                <UserPlus className="w-4 h-4" />
                                Add Member  •  {seatsTotal - seatsFilled} seat{seatsTotal - seatsFilled !== 1 ? 's' : ''} left
                            </button>
                        ) : (
                            <form
                                onSubmit={handleAddMember}
                                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-3"
                            >
                                <div className="flex-1 flex items-center gap-3 bg-black/40 border border-white/10 focus-within:border-accent-orange rounded-xl px-4 py-3 transition-colors">
                                    <Mail className="w-4 h-4 text-white/20 flex-shrink-0" />
                                    <input
                                        type="email"
                                        value={addEmail}
                                        onChange={e => setAddEmail(e.target.value)}
                                        placeholder="member@email.com"
                                        required
                                        autoFocus
                                        disabled={addLoading}
                                        className="flex-1 bg-transparent text-white text-sm font-medium outline-none placeholder:text-white/20"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={addLoading || !addEmail.trim()}
                                    className="flex items-center gap-2 px-5 py-3 bg-accent-orange hover:bg-orange-600 text-white text-sm font-black rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
                                >
                                    {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                    Add
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowAddMember(false); setAddEmail(''); }}
                                    className="p-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-xl transition-colors flex-shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* Full — no more seats */}
                {seatsFilled >= seatsTotal && (
                    <div className="mt-4 p-4 border border-white/5 rounded-2xl text-center">
                        <p className="text-white/20 text-xs font-bold uppercase tracking-widest">Team is full — 5 / 5 seats used</p>
                    </div>
                )}
            </div>
        </div>
    );
}
